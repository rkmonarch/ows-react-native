import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePolicy } from '../../src/hooks/usePolicy';
import { C, S } from '../theme';

export function PolicySetupScreen() {
  const { policy, isLoading, error, setMaxPerTx, setDailyLimit, setAllowlist, pauseWallet, resumeWallet } = usePolicy();
  const [maxInput, setMaxInput] = useState('');
  const [dailyInput, setDailyInput] = useState('');
  const [allowInput, setAllowInput] = useState('');

  const save = async (fn: () => Promise<void>, label: string) => {
    try { await fn(); Alert.alert('Saved', `${label} updated`); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : String(e)); }
  };

  if (!policy) {
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <View style={styles.empty}>
          <Ionicons name="shield-outline" size={32} color={C.textMuted} style={{ marginBottom: S.md }} />
          <Text style={styles.emptyTitle}>No Wallet Loaded</Text>
          <Text style={styles.emptySub}>Go to Setup to create or load a wallet first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {error ? <View style={styles.errorBanner}><Ionicons name="warning" size={14} color={C.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}

        {/* Current policy overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Policy</Text>
          <View style={styles.overviewGrid}>
            <OverviewCell label="Max / TX" value={`$${policy.maxPerTx.toFixed(2)}`} icon="swap-horizontal-outline" />
            <OverviewCell label="Daily Limit" value={`$${policy.dailyLimit.toFixed(2)}`} icon="calendar-outline" />
            <OverviewCell
              label="Allowlist"
              value={policy.allowlist.length === 0 ? 'Open' : `${policy.allowlist.length} addr`}
              icon="people-outline"
            />
          </View>
          <View style={styles.pauseRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Ionicons name={policy.paused ? 'pause-circle' : 'play-circle'} size={18} color={policy.paused ? C.danger : C.success} />
              <View>
                <Text style={styles.pauseTitle}>Wallet {policy.paused ? 'Paused' : 'Active'}</Text>
                <Text style={styles.pauseSub}>{policy.paused ? 'All payments blocked' : 'Payments allowed'}</Text>
              </View>
            </View>
            <Switch
              value={policy.paused}
              onValueChange={async () => {
                if (policy.paused) { await save(resumeWallet, 'Wallet resumed'); }
                else {
                  Alert.alert('Pause Wallet', 'Block all payments until resumed?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Pause', style: 'destructive', onPress: () => save(pauseWallet, 'Wallet paused') },
                  ]);
                }
              }}
              trackColor={{ false: C.border, true: C.dangerLight }}
              thumbColor={policy.paused ? C.danger : C.textMuted}
              disabled={isLoading}
            />
          </View>
        </View>

        {/* Max per TX */}
        <PolicyInput
          icon="swap-horizontal-outline"
          title="Max Per Transaction"
          hint={`Current: $${policy.maxPerTx.toFixed(2)} USDC`}
          placeholder="e.g. 1.00"
          value={maxInput}
          onChangeText={setMaxInput}
          isLoading={isLoading}
          onSave={() => {
            const v = parseFloat(maxInput);
            if (isNaN(v) || v <= 0) { Alert.alert('Invalid', 'Enter a number > 0'); return; }
            save(() => setMaxPerTx(v), 'Max per TX').then(() => setMaxInput(''));
          }}
        />

        {/* Daily limit */}
        <PolicyInput
          icon="calendar-outline"
          title="Daily Spend Limit"
          hint={`Current: $${policy.dailyLimit.toFixed(2)} USDC · resets at midnight UTC`}
          placeholder="e.g. 10.00"
          value={dailyInput}
          onChangeText={setDailyInput}
          isLoading={isLoading}
          onSave={() => {
            const v = parseFloat(dailyInput);
            if (isNaN(v) || v <= 0) { Alert.alert('Invalid', 'Enter a number > 0'); return; }
            save(() => setDailyLimit(v), 'Daily limit').then(() => setDailyInput(''));
          }}
        />

        {/* Allowlist */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="people-outline" size={18} color={C.primary} />
            <Text style={styles.cardTitle}>Recipient Allowlist</Text>
          </View>
          <Text style={styles.hint}>Paste addresses (one per line). Leave blank to allow all recipients.</Text>
          {policy.allowlist.length > 0 && (
            <View style={styles.allowlistChips}>
              {policy.allowlist.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipText}>{a.slice(0, 10)}...{a.slice(-4)}</Text>
                </View>
              ))}
            </View>
          )}
          <TextInput
            value={allowInput}
            onChangeText={setAllowInput}
            placeholder="Paste Solana addresses..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              const addrs = allowInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
              save(() => setAllowlist(addrs), addrs.length ? 'Allowlist updated' : 'Allowlist cleared').then(() => setAllowInput(''));
            }}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color={C.primary} size="small" /> : (
              <Text style={styles.secondaryBtnText}>{allowInput.trim() ? 'Save Allowlist' : 'Clear Allowlist'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Security note */}
        <View style={[styles.card, { borderColor: C.warningLight, backgroundColor: C.warningLight }]}>
          <Ionicons name="shield-checkmark" size={16} color={C.warning} style={{ marginBottom: 6 }} />
          <Text style={[styles.cardTitle, { color: C.warning, fontSize: S.small }]}>Policy Enforcement</Text>
          <Text style={{ fontSize: S.small, color: C.textSecondary, lineHeight: 20 }}>
            Policies are checked server-side before any transaction is signed. Client-side checks are a UX convenience only.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewCell({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.overviewCell}>
      <Ionicons name={icon as any} size={16} color={C.primary} style={{ marginBottom: 4 }} />
      <Text style={styles.overviewValue}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
    </View>
  );
}

function PolicyInput({ icon, title, hint, placeholder, value, onChangeText, isLoading, onSave }: any) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={18} color={C.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={C.textInverse} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  emptyTitle: { fontSize: S.subtitle, fontWeight: '700', color: C.textPrimary, marginBottom: S.xs },
  emptySub: { fontSize: S.small, color: C.textSecondary, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dangerLight, borderRadius: S.radiusSm, padding: S.sm, marginBottom: S.sm },
  errorText: { color: C.danger, fontSize: S.small, flex: 1 },
  card: { backgroundColor: C.surface, borderRadius: S.radiusMd, padding: S.md, marginBottom: S.md, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  cardTitle: { fontSize: S.body, fontWeight: '600', color: C.textPrimary },
  overviewGrid: { flexDirection: 'row', marginBottom: S.md, gap: S.sm },
  overviewCell: { flex: 1, alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: S.radiusSm, paddingVertical: 12 },
  overviewValue: { fontSize: S.body, fontWeight: '700', color: C.textPrimary },
  overviewLabel: { fontSize: S.caption, color: C.textMuted, marginTop: 2 },
  pauseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  pauseTitle: { fontSize: S.small, fontWeight: '600', color: C.textPrimary },
  pauseSub: { fontSize: S.caption, color: C.textMuted },
  hint: { fontSize: S.small, color: C.textSecondary, marginBottom: S.sm, lineHeight: 18 },
  inputRow: { flexDirection: 'row', gap: S.sm },
  input: { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: S.radiusSm, paddingHorizontal: 14, paddingVertical: 12, fontSize: S.body, color: C.textPrimary, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.primary, borderRadius: S.radiusSm, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: C.textInverse, fontWeight: '600', fontSize: S.small },
  textarea: { backgroundColor: C.surfaceAlt, borderRadius: S.radiusSm, padding: 12, fontSize: S.small, color: C.textPrimary, minHeight: 72, borderWidth: 1, borderColor: C.border, marginBottom: S.sm, textAlignVertical: 'top' },
  secondaryBtn: { borderWidth: 1, borderColor: C.primary, borderRadius: S.radiusSm, padding: 12, alignItems: 'center' },
  secondaryBtnText: { color: C.primary, fontWeight: '600', fontSize: S.small },
  allowlistChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: S.sm },
  chip: { backgroundColor: C.primaryLight, borderRadius: S.radiusFull, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: S.caption, color: C.primary, fontFamily: 'monospace' },
});
