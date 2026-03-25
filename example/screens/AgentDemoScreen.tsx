/**
 * AgentDemoScreen — Full x402 / MPP autonomous agent payment flow
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import * as LocalAuthentication from 'expo-local-authentication';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePayWithOws, useOwsWallet, parseMppChallenge } from 'ows-react-native';
import type { MppChallenge, PaymentResult } from 'ows-react-native';
import { C, S } from '../theme';

const BACKEND_URL = 'http://localhost:3001';
const BIOMETRIC_THRESHOLD = 0.5;

type StepStatus = 'pending' | 'active' | 'done' | 'error';
type Step = { id: string; label: string; status: StepStatus; detail?: string };

const STEPS: Step[] = [
  { id: 'request', label: 'Call 402-protected endpoint', status: 'pending' },
  { id: 'parse', label: 'Parse x402 challenge', status: 'pending' },
  { id: 'biometric', label: 'Biometric approval', status: 'pending' },
  { id: 'policy', label: 'OWS policy check', status: 'pending' },
  { id: 'sign', label: 'Sign & send USDC', status: 'pending' },
  { id: 'confirm', label: 'Confirmation', status: 'pending' },
];

export function AgentDemoScreen() {
  const { payMppChallenge } = usePayWithOws();
  const { wallet } = useOwsWallet('solana');
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [challenge, setChallenge] = useState<MppChallenge | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [running, setRunning] = useState(false);

  const update = (id: string, status: StepStatus, detail?: string) =>
    setSteps((p) => p.map((s) => (s.id === id ? { ...s, status, detail } : s)));

  const reset = () => { setSteps(STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus, detail: undefined }))); setChallenge(null); setResult(null); setRunning(false); };

  const run = async () => {
    if (running) return;
    if (!wallet) { Alert.alert('No Wallet', 'Create a wallet on the Setup tab first.'); return; }
    setRunning(true);
    reset();
    setRunning(true); // reset sets false, re-set

    try {
      // Step 1
      update('request', 'active');
      const res = await fetch(`${BACKEND_URL}/mock-402`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '0.10', recipient: wallet.address }),
      });
      if (res.status !== 402) { update('request', 'error', `Expected 402, got ${res.status}`); setRunning(false); return; }
      const body = await res.json() as Record<string, unknown>;
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      update('request', 'done', 'HTTP 402 received');

      // Step 2
      update('parse', 'active');
      let parsed: MppChallenge;
      try {
        parsed = parseMppChallenge(body, headers);
        setChallenge(parsed);
        update('parse', 'done', `${parsed.amountFloat} USDC → ${parsed.recipient.slice(0, 14)}...`);
      } catch (e) { update('parse', 'error', String(e)); setRunning(false); return; }

      // Step 3
      update('biometric', 'active');
      if (parsed.amountFloat > BIOMETRIC_THRESHOLD) {
        const capable = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (capable && enrolled) {
          const auth = await LocalAuthentication.authenticateAsync({ promptMessage: `Approve $${parsed.amountFloat.toFixed(2)} USDC payment` });
          if (!auth.success) { update('biometric', 'error', 'Authentication denied'); setRunning(false); return; }
          update('biometric', 'done', 'Face ID approved');
        } else {
          const ok = await new Promise<boolean>((r) => Alert.alert('Confirm Payment', `Pay $${parsed.amountFloat.toFixed(2)} USDC?`, [{ text: 'Cancel', onPress: () => r(false), style: 'cancel' }, { text: 'Approve', onPress: () => r(true) }]));
          if (!ok) { update('biometric', 'error', 'Cancelled'); setRunning(false); return; }
          update('biometric', 'done', 'Approved via dialog');
        }
      } else {
        update('biometric', 'done', `$${parsed.amountFloat} ≤ threshold — skipped`);
      }

      // Steps 4–6
      update('policy', 'active');
      update('sign', 'active');
      let payResult: PaymentResult;
      try {
        payResult = await payMppChallenge(parsed);
      } catch (e) {
        const msg = String(e);
        if (msg.toLowerCase().includes('policy')) { update('policy', 'error', msg); } else { update('sign', 'error', msg); }
        setRunning(false); return;
      }
      update('policy', 'done', 'All checks passed');
      update('sign', 'done', payResult.signature.slice(0, 18) + '...');
      update('confirm', 'done', 'Confirmed on devnet');
      setResult(payResult);
    } finally {
      setRunning(false);
    }
  };

  const allDone = steps.every((s) => s.status === 'done');

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="flash" size={26} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Research Agent</Text>
            <Text style={styles.headerSub}>Autonomous x402 payment demo</Text>
          </View>
        </View>

        {/* Launch button */}
        <TouchableOpacity
          style={[styles.launchBtn, running && styles.launchBtnRunning]}
          onPress={running ? reset : run}
          activeOpacity={0.85}
        >
          {running ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.launchBtnRunningText}>Running… tap to cancel</Text>
            </View>
          ) : allDone ? (
            <>
              <Ionicons name="refresh" size={20} color={C.textInverse} />
              <Text style={styles.launchBtnText}>Run Again</Text>
            </>
          ) : (
            <>
              <Ionicons name="play" size={20} color={C.textInverse} />
              <Text style={styles.launchBtnText}>Start Research Agent</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Payment Flow</Text>
          {steps.map((step, i) => <StepRow key={step.id} step={step} last={i === steps.length - 1} />)}
        </View>

        {/* Challenge detail */}
        {challenge && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>x402 Challenge</Text>
            <DetailRow label="Scheme" value={challenge.scheme} />
            <DetailRow label="Network" value={challenge.network} />
            <DetailRow label="Amount" value={`${challenge.amountFloat} USDC`} highlight />
            <DetailRow label="Recipient" value={`${challenge.recipient.slice(0, 16)}...`} mono />
            {challenge.memo && <DetailRow label="Memo" value={challenge.memo} />}
          </View>
        )}

        {/* Success */}
        {result && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={24} color={C.success} />
              <Text style={styles.successTitle}>Payment Confirmed</Text>
            </View>
            <DetailRow label="Amount" value={`$${result.amountUsdc.toFixed(2)} USDC`} highlight />
            <DetailRow label="Time" value={new Date(result.timestamp).toLocaleTimeString()} />
            <DetailRow label="Signature" value={result.signature.slice(0, 22) + '...'} mono />
            <TouchableOpacity style={styles.explorerBtn} onPress={() => Linking.openURL(result.explorerUrl)}>
              <Text style={styles.explorerBtnText}>View on Solana Explorer</Text>
              <Ionicons name="open-outline" size={14} color={C.success} />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  const colors: Record<StepStatus, string> = { pending: C.textMuted, active: C.primary, done: C.success, error: C.danger };
  const icons: Record<StepStatus, string> = { pending: 'ellipse-outline', active: 'radio-button-on', done: 'checkmark-circle', error: 'close-circle' };
  const color = colors[step.status];

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepLeft}>
        <Ionicons name={icons[step.status] as any} size={18} color={color} />
        {!last && <View style={[styles.stepLine, step.status === 'done' && styles.stepLineDone]} />}
      </View>
      <View style={[styles.stepContent, !last && { paddingBottom: 20 }]}>
        <Text style={[styles.stepLabel, step.status !== 'pending' && { color: C.textPrimary, fontWeight: '500' }]}>{step.label}</Text>
        {step.detail && <Text style={[styles.stepDetail, { color }]}>{step.detail}</Text>}
      </View>
    </View>
  );
}

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && { fontFamily: 'monospace' }, highlight && { color: C.primary, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: S.subtitle, fontWeight: '700', color: C.textPrimary },
  headerSub: { fontSize: S.small, color: C.textSecondary, marginTop: 2 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: S.radiusMd, padding: 16, gap: S.sm, marginBottom: S.lg },
  launchBtnRunning: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  launchBtnText: { color: C.textInverse, fontWeight: '700', fontSize: S.body },
  launchBtnRunningText: { color: C.textSecondary, fontWeight: '500', fontSize: S.body },
  stepsCard: { backgroundColor: C.surface, borderRadius: S.radiusMd, padding: S.md, borderWidth: 1, borderColor: C.border, marginBottom: S.md },
  stepsTitle: { fontSize: S.small, fontWeight: '600', color: C.textMuted, marginBottom: S.md, textTransform: 'uppercase', letterSpacing: 0.6 },
  stepRow: { flexDirection: 'row' },
  stepLeft: { alignItems: 'center', marginRight: 12, width: 18 },
  stepLine: { flex: 1, width: 1.5, backgroundColor: C.border, marginTop: 4 },
  stepLineDone: { backgroundColor: C.success },
  stepContent: { flex: 1, paddingBottom: 4 },
  stepLabel: { fontSize: S.small, color: C.textMuted },
  stepDetail: { fontSize: S.caption, marginTop: 2 },
  card: { backgroundColor: C.surface, borderRadius: S.radiusMd, padding: S.md, borderWidth: 1, borderColor: C.border, marginBottom: S.md },
  cardTitle: { fontSize: S.small, fontWeight: '600', color: C.textSecondary, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: S.small, color: C.textSecondary },
  detailValue: { fontSize: S.small, color: C.textPrimary },
  successCard: { backgroundColor: C.successLight, borderRadius: S.radiusMd, padding: S.md, borderWidth: 1, borderColor: C.success, marginBottom: S.md },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  successTitle: { fontSize: S.body, fontWeight: '700', color: C.success },
  explorerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: S.sm, marginTop: S.sm, borderTopWidth: 1, borderTopColor: 'rgba(18,183,106,0.2)' },
  explorerBtnText: { fontSize: S.small, fontWeight: '600', color: C.success },
});
