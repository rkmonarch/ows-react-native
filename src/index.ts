/**
 * @ows/react-native
 *
 * React Native library wrapping the Open Wallet Standard (OWS) for secure,
 * policy-gated agent payments on Solana using USDC.
 *
 * Supports Stripe MPP / x402 HTTP 402 challenges.
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

// Context & Provider
export { OwsProvider, useOws } from './components/OwsProvider';
export type { OwsProviderProps } from './components/OwsProvider';

// Hooks
export { useOwsWallet } from './hooks/useOwsWallet';
export { usePayWithOws } from './hooks/usePayWithOws';
export { usePolicy } from './hooks/usePolicy';

// Components
export { TransactionHistory } from './components/TransactionHistory';
export type { TransactionHistoryProps } from './components/TransactionHistory';

// Utilities
export { parseMppChallenge, buildMockChallenge, validateChallenge } from './utils/mppParser';

// Types — re-export all for consumer type safety
export type {
  SupportedChain,
  OWSWallet,
  WalletBalance,
  OWSPolicy,
  PolicyUpdateRequest,
  MppChallenge,
  PaymentResult,
  Transaction,
  OwsContextValue,
  UseOwsWalletReturn,
  UsePayWithOwsReturn,
  DirectPayParams,
  UsePolicyReturn,
} from './types';
