/**
 * TransactionHistory — displays the in-memory list of OWS transactions.
 *
 * A lightweight, zero-dependency component that renders the transaction
 * history from the OWS context. Styling is done with React Native
 * StyleSheet (NativeWind class names added as props for the example app).
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import React from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useOws } from './OwsProvider';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TransactionHistoryProps {
  /** Maximum number of transactions to display (default: all) */
  limit?: number;
  /** Show the "Open in Explorer" link */
  showExplorerLink?: boolean;
  /** Called when user taps a transaction row */
  onTransactionPress?: (tx: Transaction) => void;
  /** Override container style */
  style?: object;
  /** Show loading skeleton (e.g. when balance is loading) */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionHistory({
  limit,
  showExplorerLink = true,
  onTransactionPress,
  style,
  isLoading = false,
  emptyMessage = 'No transactions yet. Start an agent payment to see history here.',
}: TransactionHistoryProps) {
  const { transactions } = useOws();

  const displayTxs = limit ? transactions.slice(0, limit) : transactions;

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#9945FF" />
      </View>
    );
  }

  if (displayTxs.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyIcon}>💳</Text>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      {displayTxs.map((tx) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          showExplorerLink={showExplorerLink}
          onPress={onTransactionPress}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

interface TransactionRowProps {
  tx: Transaction;
  showExplorerLink: boolean;
  onPress?: (tx: Transaction) => void;
}

function TransactionRow({ tx, showExplorerLink, onPress }: TransactionRowProps) {
  const date = new Date(tx.timestamp);
  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusColor =
    tx.status === 'confirmed'
      ? '#14F195' // Solana green
      : tx.status === 'pending'
      ? '#F5A623'
      : '#FF5D5D';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress?.(tx)}
      activeOpacity={0.7}
    >
      {/* Left: icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{tx.isMppPayment ? '🤖' : '💸'}</Text>
      </View>

      {/* Middle: details */}
      <View style={styles.details}>
        <Text style={styles.recipient} numberOfLines={1}>
          {shortenAddress(tx.recipient)}
        </Text>
        {tx.memo ? (
          <Text style={styles.memo} numberOfLines={1}>
            {tx.memo}
          </Text>
        ) : null}
        <Text style={styles.timestamp}>
          {formattedDate} · {formattedTime}
        </Text>
        {showExplorerLink && (
          <TouchableOpacity onPress={() => Linking.openURL(tx.explorerUrl)}>
            <Text style={styles.explorerLink}>View on Explorer →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Right: amount + status */}
      <View style={styles.right}>
        <Text style={styles.amount}>-${tx.amountUsdc.toFixed(2)}</Text>
        <Text style={[styles.status, { color: statusColor }]}>
          {tx.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    marginBottom: 8,
    padding: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252547',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  details: {
    flex: 1,
  },
  recipient: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  memo: {
    fontSize: 12,
    color: '#9945FF',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  explorerLink: {
    fontSize: 11,
    color: '#14F195',
    textDecorationLine: 'underline',
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  status: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});
