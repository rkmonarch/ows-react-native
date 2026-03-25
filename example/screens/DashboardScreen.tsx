import React, { useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOwsWallet } from "ows-react-native";
import { usePolicy } from "ows-react-native";
import { C, S } from "../theme";

export function DashboardScreen() {
  const { wallet, balance, refreshBalance, isLoading } = useOwsWallet("solana");
  const { policy } = usePolicy();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    setRefreshing(false);
  };

  if (!wallet) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="wallet-outline" size={28} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Wallet</Text>
          <Text style={styles.emptySub}>
            Go to Setup to create or load a wallet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{wallet.label || "oscar"}</Text>
          {isLoading && !balance ? (
            <ActivityIndicator
              color={C.primary}
              style={{ marginVertical: 12 }}
            />
          ) : (
            <Text style={styles.balanceAmount}>
              ${balance ? balance.usdc.toFixed(2) : "0.00"}
            </Text>
          )}
          <Text style={styles.solBalance}>
            {balance ? balance.sol.toFixed(4) : "0.0000"} SOL
          </Text>

          {/* Address row */}
          <TouchableOpacity
            style={styles.addrRow}
            onPress={() => {
              Clipboard.setString(wallet.address);
              Alert.alert("Copied", "Address copied");
            }}
          >
            <Text style={styles.addrText} numberOfLines={1}>
              {wallet.address.slice(0, 14)}...{wallet.address.slice(-8)}
            </Text>
            <Ionicons name="copy-outline" size={14} color={C.textMuted} />
          </TouchableOpacity>

          <View style={styles.networkPill}>
            <View style={styles.networkDot} />
            <Text style={styles.networkText}>Solana Devnet</Text>
          </View>
        </View>

        {/* Policy summary */}
        {policy && (
          <>
            <Text style={styles.sectionLabel}>SPEND POLICY</Text>
            <View style={styles.policyRow}>
              <PolicyStat
                icon="swap-horizontal"
                label="Per TX"
                value={`$${policy.maxPerTx.toFixed(2)}`}
              />
              <View style={styles.divider} />
              <PolicyStat
                icon="calendar-outline"
                label="Daily"
                value={`$${policy.dailyLimit.toFixed(2)}`}
              />
              <View style={styles.divider} />
              <PolicyStat
                icon={policy.paused ? "pause-circle" : "checkmark-circle"}
                label="Status"
                value={policy.paused ? "Paused" : "Active"}
                valueColor={policy.paused ? C.danger : C.success}
              />
            </View>
          </>
        )}

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <ActionButton icon="refresh" label="Refresh" onPress={onRefresh} />
          <ActionButton
            icon="open-outline"
            label="Explorer"
            onPress={() =>
              Alert.alert(
                "Explorer",
                `https://explorer.solana.com/address/${wallet.address}?cluster=devnet`,
              )
            }
          />
          <ActionButton
            icon="share-outline"
            label="Copy Addr"
            onPress={() => {
              Clipboard.setString(wallet.address);
              Alert.alert("Copied", "Wallet address copied");
            }}
          />
        </View>

        {/* Wallet detail */}
        <Text style={styles.sectionLabel}>WALLET DETAILS</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Label" value={wallet.label || "Oscar"} />
          <DetailRow label="Chain" value="Solana" />
          <DetailRow label="ID" value={wallet.id.slice(0, 18) + "..."} mono />
          <DetailRow
            label="Created"
            value={new Date(wallet.createdAt).toLocaleDateString()}
            last
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyStat({
  icon,
  label,
  value,
  valueColor = C.textPrimary,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Ionicons name={icon as any} size={18} color={valueColor} />
      <Text style={{ color: valueColor, fontWeight: "700", fontSize: S.body }}>
        {value}
      </Text>
      <Text style={{ color: C.textMuted, fontSize: S.caption }}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon as any} size={20} color={C.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && { fontFamily: "monospace" }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: 40 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: S.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.md,
  },
  emptyTitle: {
    fontSize: S.subtitle,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: S.xs,
  },
  emptySub: { fontSize: S.small, color: C.textSecondary, textAlign: "center" },
  balanceCard: {
    backgroundColor: C.primary,
    borderRadius: S.radiusXl,
    padding: S.lg,
    marginBottom: S.lg,
  },
  balanceLabel: {
    fontSize: S.small,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: "800",
    color: C.textInverse,
    marginBottom: 2,
  },
  solBalance: {
    fontSize: S.small,
    color: "rgba(255,255,255,0.6)",
    marginBottom: S.md,
  },
  addrRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: S.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    marginBottom: S.sm,
  },
  addrText: {
    flex: 1,
    fontSize: S.caption,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "monospace",
  },
  networkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#5FFFB0",
  },
  networkText: { fontSize: S.caption, color: "rgba(255,255,255,0.7)" },
  sectionLabel: {
    fontSize: S.caption,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: S.sm,
    marginTop: S.sm,
  },
  policyRow: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: S.radiusMd,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.md,
    alignItems: "center",
  },
  divider: { width: 1, height: 40, backgroundColor: C.border },
  actionsRow: { flexDirection: "row", gap: S.sm, marginBottom: S.md },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: S.radiusMd,
    padding: S.sm,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: S.caption,
    color: C.textSecondary,
    fontWeight: "500",
  },
  detailCard: {
    backgroundColor: C.surface,
    borderRadius: S.radiusMd,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.md,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: S.md,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { fontSize: S.small, color: C.textSecondary },
  detailValue: { fontSize: S.small, color: C.textPrimary, fontWeight: "500" },
});
