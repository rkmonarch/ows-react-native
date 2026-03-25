/**
 * usePolicy — hook for reading and updating OWS spend policies.
 *
 * Policies are enforced on the backend before any signing occurs.
 * This hook provides a convenient UI layer for policy management.
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import { useCallback, useState } from 'react';
import { useOws } from '../components/OwsProvider';
import type { PolicyUpdateRequest, UsePolicyReturn } from '../types';
import { createApiClient } from '../utils/apiClient';

/**
 * usePolicy
 *
 * @example
 * const { policy, setDailyLimit, setMaxPerTx, pauseWallet } = usePolicy();
 * await setDailyLimit(10); // $10 USDC per day
 * await setMaxPerTx(1);    // $1 USDC max per transaction
 */
export function usePolicy(): UsePolicyReturn {
  const { backendUrl, activeWallet, policy, refreshPolicy } = useOws();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = createApiClient(backendUrl);

  // ---------------------------------------------------------------------------
  // Generic update helper
  // ---------------------------------------------------------------------------

  const updatePolicy = useCallback(
    async (updates: PolicyUpdateRequest): Promise<void> => {
      if (!activeWallet) {
        throw new Error('No active wallet');
      }
      setIsLoading(true);
      setError(null);
      try {
        await api.updatePolicy(activeWallet.id, updates);
        // Refresh from backend so the context reflects the latest state
        await refreshPolicy();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [activeWallet, api, refreshPolicy]
  );

  // ---------------------------------------------------------------------------
  // Granular setters — each maps to a single policy field update
  // ---------------------------------------------------------------------------

  const setMaxPerTx = useCallback(
    (amount: number) => {
      if (amount <= 0) return Promise.reject(new Error('maxPerTx must be > 0'));
      return updatePolicy({ maxPerTx: amount });
    },
    [updatePolicy]
  );

  const setDailyLimit = useCallback(
    (amount: number) => {
      if (amount <= 0) return Promise.reject(new Error('dailyLimit must be > 0'));
      return updatePolicy({ dailyLimit: amount });
    },
    [updatePolicy]
  );

  const setAllowlist = useCallback(
    (addresses: string[]) => {
      // Basic validation — each Solana address is 32–44 chars base58
      for (const addr of addresses) {
        if (addr.length < 32 || addr.length > 44) {
          return Promise.reject(new Error(`Invalid address: ${addr}`));
        }
      }
      return updatePolicy({ allowlist: addresses });
    },
    [updatePolicy]
  );

  const pauseWallet = useCallback(
    () => updatePolicy({ paused: true }),
    [updatePolicy]
  );

  const resumeWallet = useCallback(
    () => updatePolicy({ paused: false }),
    [updatePolicy]
  );

  return {
    policy,
    isLoading,
    error,
    setMaxPerTx,
    setDailyLimit,
    setAllowlist,
    pauseWallet,
    resumeWallet,
    refreshPolicy,
  };
}
