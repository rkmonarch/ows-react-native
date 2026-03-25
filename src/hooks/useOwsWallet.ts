/**
 * useOwsWallet — hook for wallet creation, loading, and balance management.
 *
 * SECURITY: Private keys are NEVER returned to the React Native side.
 * The backend vault manages keys; this hook only receives public addresses.
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import { useCallback, useEffect, useState } from 'react';
import { useOws } from '../components/OwsProvider';
import type { OWSWallet, UseOwsWalletReturn, WalletBalance } from '../types';
import { createApiClient } from '../utils/apiClient';

/**
 * useOwsWallet
 *
 * @param chain  Currently only 'solana' is supported (future: 'ethereum', 'base')
 *
 * @example
 * const { wallet, balance, createWallet, getBalance } = useOwsWallet('solana');
 * await createWallet('My Agent Wallet');
 * const bal = await getBalance();
 * console.log('USDC:', bal.usdc);
 */
export function useOwsWallet(chain: 'solana' = 'solana'): UseOwsWalletReturn {
  const { backendUrl, activeWallet, setActiveWallet } = useOws();

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable API client for this hook instance
  const api = createApiClient(backendUrl);

  // ---------------------------------------------------------------------------
  // createWallet — generate a new keypair in the backend vault
  // ---------------------------------------------------------------------------

  const createWallet = useCallback(
    async (label?: string): Promise<OWSWallet> => {
      setIsLoading(true);
      setError(null);
      try {
        const { wallet } = await api.createWallet(label);
        // Validate that the returned wallet is for the requested chain
        if (wallet.chain !== chain) {
          throw new Error(
            `Backend returned wallet for chain "${wallet.chain}", expected "${chain}"`
          );
        }
        setActiveWallet(wallet);
        return wallet;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api, chain, setActiveWallet]
  );

  // ---------------------------------------------------------------------------
  // listWallets — fetch all wallets from the vault
  // ---------------------------------------------------------------------------

  const listWallets = useCallback(async (): Promise<OWSWallet[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const { wallets } = await api.listWallets();
      return wallets.filter((w) => w.chain === chain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [api, chain]);

  // ---------------------------------------------------------------------------
  // loadWallet — set a specific wallet as active by ID
  // ---------------------------------------------------------------------------

  const loadWallet = useCallback(
    async (walletId: string): Promise<OWSWallet> => {
      setIsLoading(true);
      setError(null);
      try {
        const wallets = await listWallets();
        const found = wallets.find((w) => w.id === walletId);
        if (!found) {
          throw new Error(`Wallet "${walletId}" not found in vault`);
        }
        setActiveWallet(found);
        return found;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [listWallets, setActiveWallet]
  );

  // ---------------------------------------------------------------------------
  // getAddress — return the active wallet's public key (or null)
  // ---------------------------------------------------------------------------

  const getAddress = useCallback((): string | null => {
    return activeWallet?.address ?? null;
  }, [activeWallet]);

  // ---------------------------------------------------------------------------
  // getBalance — fetch SOL + USDC balance from the backend/chain
  // ---------------------------------------------------------------------------

  const getBalance = useCallback(async (): Promise<WalletBalance> => {
    if (!activeWallet) {
      throw new Error('No active wallet. Call createWallet() or loadWallet() first.');
    }
    setIsLoading(true);
    setError(null);
    try {
      const { balance: bal } = await api.getBalance(activeWallet.id);
      setBalance(bal);
      return bal;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeWallet, api]);

  // ---------------------------------------------------------------------------
  // refreshBalance — convenience alias that swallows errors (for polling)
  // ---------------------------------------------------------------------------

  const refreshBalance = useCallback(async (): Promise<void> => {
    try {
      await getBalance();
    } catch {
      // errors already set in state
    }
  }, [getBalance]);

  // Auto-fetch balance when active wallet changes
  useEffect(() => {
    if (activeWallet) {
      refreshBalance();
    } else {
      setBalance(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWallet?.id]);

  return {
    wallet: activeWallet,
    balance,
    isLoading,
    error,
    createWallet,
    loadWallet,
    listWallets,
    getAddress,
    getBalance,
    refreshBalance,
  };
}
