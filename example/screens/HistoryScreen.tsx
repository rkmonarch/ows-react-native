import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOws } from 'ows-react-native';
import type { Transaction } from 'ows-react-native';
import { C, S } from '../theme';

export function HistoryScreen() {
  const { transactions } = useOws();
  const totalSpent = transactions.reduce((s, t) => s + t.amountUsdc, 0);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      {/* Stats bar */}
      {transactions.length > 0 && (
        <View style={styles.statsBar}>
          <StatCell label="Transactions" value={String(transactions.length)} />
          <View style={styles.statDivider} />
          <StatCell label="Total Spent" value={`$${totalSpent.toFixed(2)}`} />
          <View style={styles.statDivider} />
          <StatCell label="Agent Pays" value={String(transactions.filter((t) => t.isMppPayment).length)} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={28} color={C.textMuted} /></View>
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptySub}>Run the agent demo to see payment history here.</Text>
          </View>
        ) : (
          transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const date = new Date(tx.timestamp);
  const statusColor = tx.status === 'confirmed' ? C.success : tx.status === 'pending' ? C.warning : C.danger;

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, tx.isMppPayment ? styles.rowIconAgent : styles.rowIconDirect]}>
        <Ionicons name={tx.isMppPayment ? 'flash' : 'arrow-up'} size={16} color={tx.isMppPayment ? C.primary : C.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowRecipient} numberOfLines={1}>
            {tx.recipient.slice(0, 10)}...{tx.recipient.slice(-4)}
          </Text>
          <Text style={styles.rowAmount}>-${tx.amountUsdc.toFixed(2)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowDate}>{date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={[styles.rowStatus, { color: statusColor }]}>{tx.status}</Text>
        </View>
        {tx.memo && <Text style={styles.rowMemo} numberOfLines={1}>{tx.memo}</Text>}
        <TouchableOpacity onPress={() => Linking.openURL(tx.explorerUrl)}>
          <Text style={styles.rowExplorer}>View on Explorer →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  statsBar: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: S.md },
  statValue: { fontSize: S.subtitle, fontWeight: '700', color: C.textPrimary },
  statLabel: { fontSize: S.caption, color: C.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: C.border },
  scroll: { padding: S.md, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: S.md },
  emptyTitle: { fontSize: S.subtitle, fontWeight: '700', color: C.textPrimary, marginBottom: S.xs },
  emptySub: { fontSize: S.small, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: S.radiusMd, padding: S.md, marginBottom: S.sm, borderWidth: 1, borderColor: C.border, gap: S.sm },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowIconAgent: { backgroundColor: C.primaryLight },
  rowIconDirect: { backgroundColor: C.surfaceAlt },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowRecipient: { fontSize: S.body, fontWeight: '600', color: C.textPrimary, flex: 1 },
  rowAmount: { fontSize: S.body, fontWeight: '700', color: C.textPrimary },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowDate: { fontSize: S.caption, color: C.textMuted },
  rowStatus: { fontSize: S.caption, fontWeight: '500', textTransform: 'capitalize' },
  rowMemo: { fontSize: S.caption, color: C.primary, marginBottom: 2 },
  rowExplorer: { fontSize: S.caption, color: C.primary, textDecorationLine: 'underline' },
});
