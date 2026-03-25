/**
 * usePayWithOws — hook for triggering policy-gated USDC payments on Solana.
 *
 * Flow:
 *   1. Receive an MppChallenge (parsed from 402 response or built manually)
 *   2. Validate locally (amount, recipient format)
 *   3. Send to backend /pay-mpp (backend checks OWS policies, then signs + sends)
 *   4. Return the PaymentResult with signature + Explorer URL
 *
 * SECURITY: Signing always happens on the backend. The RN app only sends
 * payment intent; the backend enforces all policies before signing.
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import { useCallback, useState } from 'react';
import { useOws } from '../components/OwsProvider';
import type {
  DirectPayParams,
  MppChallenge,
  PaymentResult,
  Transaction,
  UsePayWithOwsReturn,
} from '../types';
import { createApiClient } from '../utils/apiClient';
import { validateChallenge } from '../utils/mppParser';

/**
 * usePayWithOws
 *
 * @example
 * const { payMppChallenge, isLoading, lastPayment } = usePayWithOws();
 *
 * // Called automatically when a 402 response is received:
 * const result = await payMppChallenge(parsedChallenge);
 * console.log('Paid! TX:', result.explorerUrl);
 */
export function usePayWithOws(): UsePayWithOwsReturn {
  const { backendUrl, activeWallet, policy, addTransaction } = useOws();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<PaymentResult | null>(null);

  const api = createApiClient(backendUrl);

  // ---------------------------------------------------------------------------
  // Client-side policy guard (mirrors backend — defence in depth)
  // ---------------------------------------------------------------------------

  function checkPolicyLocally(amountUsdc: number, recipient: string): string | null {
    if (!policy) return null; // If no policy loaded, defer to backend

    if (policy.paused) {
      return 'Wallet is paused — no payments allowed. Unpause in Policy Settings.';
    }

    if (amountUsdc > policy.maxPerTx) {
      return `Amount $${amountUsdc.toFixed(2)} exceeds per-transaction limit of $${policy.maxPerTx.toFixed(2)} USDC`;
    }

    if (
      policy.allowlist.length > 0 &&
      !policy.allowlist.includes(recipient)
    ) {
      return `Recipient ${recipient} is not on the allowlist`;
    }

    if (policy.merchantLimits && policy.merchantLimits[recipient] !== undefined) {
      const limit = policy.merchantLimits[recipient];
      if (amountUsdc > limit) {
        return `Amount $${amountUsdc.toFixed(2)} exceeds merchant limit of $${limit.toFixed(2)} for this recipient`;
      }
    }

    return null; // Passed all local checks
  }

  // ---------------------------------------------------------------------------
  // payMppChallenge — primary entry point for 402-driven payments
  // ---------------------------------------------------------------------------

  const payMppChallenge = useCallback(
    async (challenge: MppChallenge): Promise<PaymentResult> => {
      if (!activeWallet) {
        throw new Error('No active wallet. Initialize a wallet first.');
      }

      // 1. Validate challenge format
      const validationError = validateChallenge(challenge);
      if (validationError) {
        throw new Error(`Invalid challenge: ${validationError}`);
      }

      // 2. Client-side policy check (backend will also verify)
      const policyError = checkPolicyLocally(
        challenge.amountFloat,
        challenge.recipient
      );
      if (policyError) {
        throw new Error(`Policy violation: ${policyError}`);
      }

      setIsLoading(true);
      setError(null);

      try {
        // 3. Delegate to backend — backend performs final policy check + signs + sends
        const { result } = await api.payMpp(activeWallet.id, challenge);

        // 4. Record in transaction history
        const tx: Transaction = {
          id: result.signature,
          signature: result.signature,
          explorerUrl: result.explorerUrl,
          amountUsdc: result.amountUsdc,
          recipient: result.recipient,
          timestamp: result.timestamp,
          status: 'confirmed',
          memo: result.memo,
          isMppPayment: true,
        };
        addTransaction(tx);

        setLastPayment(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeWallet, policy, backendUrl]
  );

  // ---------------------------------------------------------------------------
  // payDirect — bypass the 402 flow for manual/direct payments
  // ---------------------------------------------------------------------------

  const payDirect = useCallback(
    async (params: DirectPayParams): Promise<PaymentResult> => {
      if (!activeWallet) {
        throw new Error('No active wallet. Initialize a wallet first.');
      }

      // Client-side policy check
      const policyError = checkPolicyLocally(params.amountUsdc, params.recipient);
      if (policyError) {
        throw new Error(`Policy violation: ${policyError}`);
      }

      setIsLoading(true);
      setError(null);

      try {
        const { result } = await api.paySolanaUsdc({
          walletId: activeWallet.id,
          recipient: params.recipient,
          amountUsdc: params.amountUsdc,
          memo: params.memo,
        });

        const tx: Transaction = {
          id: result.signature,
          signature: result.signature,
          explorerUrl: result.explorerUrl,
          amountUsdc: result.amountUsdc,
          recipient: result.recipient,
          timestamp: result.timestamp,
          status: 'confirmed',
          memo: result.memo,
          isMppPayment: false,
        };
        addTransaction(tx);

        setLastPayment(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeWallet, policy, backendUrl]
  );

  return {
    isLoading,
    error,
    lastPayment,
    payMppChallenge,
    payDirect,
  };
}
