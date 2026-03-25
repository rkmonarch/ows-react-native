import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOwsWallet } from "../../src/hooks/useOwsWallet";
import type { OWSWallet } from "../../src/types";
import { C, S } from "../theme";

export function OnboardingScreen() {
  const { wallet, createWallet, listWallets, loadWallet, isLoading, error } =
    useOwsWallet("solana");
  const [existing, setExisting] = useState<OWSWallet[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    listWallets()
      .then(setExisting)
      .catch(() => {})
      .finally(() => setLoadingList(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    try {
      const w = await createWallet("oscar");
      setExisting((p) => [w, ...p]);
      Alert.alert(
        "Wallet Created",
        `Your Solana wallet is ready.\n\n${w.address.slice(0, 24)}...`,
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet" size={32} color={C.primary} />
          </View>
          <Text style={styles.heroTitle}>Oscar</Text>
          <Text style={styles.heroSub}>
            Policy-gated payments on Solana.{"\n"}Keys stay on the backend —
            always.
          </Text>
        </View>

        {/* Active wallet pill */}
        {wallet && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText} numberOfLines={1}>
              {wallet.address.slice(0, 16)}...{wallet.address.slice(-6)}
            </Text>
            <Text style={styles.activeLabel}>Active</Text>
          </View>
        )}

        {/* Create button */}
        <TouchableOpacity
          style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={C.textInverse} />
          ) : (
            <>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={C.textInverse}
              />
              <Text style={styles.primaryBtnText}>Create New Wallet</Text>
            </>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Existing wallets */}
        {!loadingList && existing.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VAULT WALLETS</Text>
            {existing.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.walletRow,
                  wallet?.id === w.id && styles.walletRowActive,
                ]}
                onPress={() => loadWallet(w.id)}
              >
                <View style={styles.walletIcon}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={18}
                    color={wallet?.id === w.id ? C.primary : C.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletLabel}>{w.label || "Unnamed"}</Text>
                  <Text style={styles.walletAddr} numberOfLines={1}>
                    {w.address.slice(0, 20)}...{w.address.slice(-4)}
                  </Text>
                </View>
                {wallet?.id === w.id ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={C.success}
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={C.textMuted}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Funding guide */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fund Your Devnet Wallet</Text>
          {[
            { n: "1", t: "Get devnet SOL for fees", sub: "faucet.solana.com" },
            { n: "2", t: "Get devnet USDC", sub: "spl-token-faucet.com" },
            {
              n: "3",
              t: "Verify on Explorer",
              sub: "explorer.solana.com/?cluster=devnet",
            },
          ].map((s) => (
            <View key={s.n} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{s.n}</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>{s.t}</Text>
                <Text style={styles.stepSub}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Security note */}
        <View style={[styles.card, styles.infoCard]}>
          <Ionicons
            name="lock-closed"
            size={16}
            color={C.primary}
            style={{ marginBottom: 6 }}
          />
          <Text style={styles.infoTitle}>Security Model</Text>
          <Text style={styles.infoBody}>
            Private keys are generated and stored in the backend vault. This app
            only ever receives your public address. All payments are
            policy-checked before signing.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: 40 },
  hero: { alignItems: "center", paddingVertical: S.xl, marginBottom: S.sm },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.md,
  },
  heroTitle: {
    fontSize: S.display,
    fontWeight: "700",
    color: C.textPrimary,
    marginBottom: S.xs,
  },
  heroSub: {
    fontSize: S.small,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.successLight,
    borderRadius: S.radiusFull,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: S.md,
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  activeBadgeText: {
    flex: 1,
    fontSize: S.small,
    color: C.textPrimary,
    fontFamily: "monospace",
  },
  activeLabel: { fontSize: S.caption, fontWeight: "600", color: C.success },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
    borderRadius: S.radiusMd,
    padding: 16,
    gap: 8,
    marginBottom: S.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: C.textInverse, fontWeight: "700", fontSize: S.body },
  error: { color: C.danger, fontSize: S.small, marginBottom: S.sm },
  section: { marginTop: S.md, marginBottom: S.md },
  sectionLabel: {
    fontSize: S.caption,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.8,
    marginBottom: S.sm,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: S.radiusMd,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  walletRowActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  walletLabel: { fontSize: S.body, fontWeight: "600", color: C.textPrimary },
  walletAddr: {
    fontSize: S.caption,
    color: C.textMuted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: S.radiusLg,
    padding: S.md,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontSize: S.subtitle,
    fontWeight: "600",
    color: C.textPrimary,
    marginBottom: S.md,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: S.caption, fontWeight: "700", color: C.primary },
  stepTitle: { fontSize: S.small, fontWeight: "500", color: C.textPrimary },
  stepSub: { fontSize: S.caption, color: C.textMuted, marginTop: 1 },
  infoCard: { borderColor: C.primaryLight, backgroundColor: C.primaryLight },
  infoTitle: {
    fontSize: S.small,
    fontWeight: "700",
    color: C.primary,
    marginBottom: 4,
  },
  infoBody: { fontSize: S.small, color: C.textSecondary, lineHeight: 20 },
});
