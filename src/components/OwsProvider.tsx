/**
 * OwsProvider — React context for the OWS React Native library.
 *
 * Wrap your app (or the relevant subtree) with this provider.
 * It exposes the backend URL, active wallet state, policies,
 * and transaction history to all child hooks and components.
 *
 * Usage:
 *   <OwsProvider backendUrl="http://localhost:3001">
 *     <App />
 *   </OwsProvider>
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  OWSPolicy,
  OWSWallet,
  OwsContextValue,
  Transaction,
} from '../types';
import { createApiClient } from '../utils/apiClient';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OwsContext = createContext<OwsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface OwsProviderProps {
  /** Base URL of the OWS backend, e.g. "http://localhost:3001" */
  backendUrl: string;
  children: React.ReactNode;
  /** Maximum transactions to keep in memory (default: 50) */
  maxHistorySize?: number;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export function OwsProvider({
  backendUrl,
  children,
  maxHistorySize = 50,
}: OwsProviderProps) {
  const [activeWallet, setActiveWalletState] = useState<OWSWallet | null>(null);
  const [policy, setPolicyState] = useState<OWSPolicy | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Keep a stable ref to the API client — recreate only when backendUrl changes
  const apiRef = useRef(createApiClient(backendUrl));
  useEffect(() => {
    apiRef.current = createApiClient(backendUrl);
  }, [backendUrl]);

  // ---------------------------------------------------------------------------
  // Active wallet setter — also clears policy when wallet changes
  // ---------------------------------------------------------------------------

  const setActiveWallet = useCallback((wallet: OWSWallet | null) => {
    setActiveWalletState(wallet);
    if (!wallet) setPolicyState(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Refresh policy from backend
  // ---------------------------------------------------------------------------

  const refreshPolicy = useCallback(async () => {
    if (!activeWallet) return;
    try {
      const { policy: p } = await apiRef.current.getPolicy(activeWallet.id);
      setPolicyState(p);
    } catch (err) {
      console.warn('[OWS] Could not refresh policy:', err);
    }
  }, [activeWallet]);

  // Auto-refresh policy when wallet changes
  useEffect(() => {
    if (activeWallet) {
      refreshPolicy();
    }
  }, [activeWallet, refreshPolicy]);

  // ---------------------------------------------------------------------------
  // Add a transaction to the in-memory history (newest first)
  // ---------------------------------------------------------------------------

  const addTransaction = useCallback(
    (tx: Transaction) => {
      setTransactions((prev) => [tx, ...prev].slice(0, maxHistorySize));
    },
    [maxHistorySize]
  );

  // ---------------------------------------------------------------------------
  // Context value (memoized to prevent unnecessary re-renders)
  // ---------------------------------------------------------------------------

  const value = useMemo<OwsContextValue>(
    () => ({
      backendUrl,
      activeWallet,
      setActiveWallet,
      policy,
      transactions,
      addTransaction,
      refreshPolicy,
    }),
    [
      backendUrl,
      activeWallet,
      setActiveWallet,
      policy,
      transactions,
      addTransaction,
      refreshPolicy,
    ]
  );

  return <OwsContext.Provider value={value}>{children}</OwsContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook to consume the context
// ---------------------------------------------------------------------------

/**
 * useOws — access the OWS context.
 * Must be used inside <OwsProvider>.
 */
export function useOws(): OwsContextValue {
  const ctx = useContext(OwsContext);
  if (!ctx) {
    throw new Error(
      '[OWS] useOws() must be called inside an <OwsProvider>. ' +
        'Wrap your app with <OwsProvider backendUrl="http://localhost:3001">.'
    );
  }
  return ctx;
}
