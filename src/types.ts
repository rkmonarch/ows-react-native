/**
 * @ows/react-native — Type Definitions
 *
 * Core types for the Open Wallet Standard React Native library.
 * These types model wallets, policies, payments, and x402/MPP challenges.
 */

// ---------------------------------------------------------------------------
// Chain support
// ---------------------------------------------------------------------------

export type SupportedChain = 'solana';

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export interface OWSWallet {
  /** Unique wallet ID (UUIDv4) managed by the backend vault */
  id: string;
  /** Base58 public key (Solana) */
  address: string;
  /** Chain this wallet belongs to */
  chain: SupportedChain;
  /** Human-readable label */
  label?: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}

export interface WalletBalance {
  /** Native SOL balance in SOL units */
  sol: number;
  /** USDC balance (6 decimals, displayed as float) */
  usdc: number;
  /** Raw lamports for SOL */
  lamports: number;
  /** Raw USDC base units (6 decimals) */
  usdcRaw: number;
}

// ---------------------------------------------------------------------------
// OWS Policy — controls what agents are allowed to spend
// ---------------------------------------------------------------------------

export interface OWSPolicy {
  /** Maximum USDC per single transaction (e.g. 1.00) */
  maxPerTx: number;
  /** Daily spend limit in USDC (rolling 24h) */
  dailyLimit: number;
  /** Allowlisted recipient addresses (empty = allow all) */
  allowlist: string[];
  /** Block all payments if true (kill-switch) */
  paused: boolean;
  /** Optional: per-merchant limits { address: maxUSDC } */
  merchantLimits?: Record<string, number>;
}

export interface PolicyUpdateRequest {
  maxPerTx?: number;
  dailyLimit?: number;
  allowlist?: string[];
  paused?: boolean;
  merchantLimits?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// x402 / Stripe MPP Challenge
// ---------------------------------------------------------------------------

/**
 * Parsed representation of an HTTP 402 Payment Required response
 * following the Stripe MPP / x402 specification.
 *
 * See: https://stripe.com/blog/machine-to-machine-payments
 */
export interface MppChallenge {
  /** Payment scheme — "exact" for fixed-amount USDC */
  scheme: 'exact' | 'streaming' | string;
  /** Chain the payment should be made on */
  network: string;
  /** Recipient wallet address */
  recipient: string;
  /** USDC amount (human-readable, e.g. "0.10") */
  amount: string;
  /** USDC amount as float */
  amountFloat: number;
  /** Token mint address */
  tokenMint: string;
  /** Optional memo / reference for reconciliation */
  memo?: string;
  /** Optional payment reference (for MPP matching) */
  reference?: string;
  /** Raw x-payment header or body for re-submission */
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Payment result
// ---------------------------------------------------------------------------

export interface PaymentResult {
  /** Solana transaction signature */
  signature: string;
  /** Solana Explorer URL for the transaction */
  explorerUrl: string;
  /** Amount paid in USDC */
  amountUsdc: number;
  /** Recipient address */
  recipient: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Memo attached to the transaction, if any */
  memo?: string;
}

// ---------------------------------------------------------------------------
// Transaction history
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  signature: string;
  explorerUrl: string;
  amountUsdc: number;
  recipient: string;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  memo?: string;
  /** Whether this was triggered by an MPP/x402 challenge */
  isMppPayment: boolean;
}

// ---------------------------------------------------------------------------
// Context value shapes
// ---------------------------------------------------------------------------

export interface OwsContextValue {
  /** Backend base URL, e.g. http://localhost:3001 */
  backendUrl: string;
  /** Currently active wallet, if any */
  activeWallet: OWSWallet | null;
  /** Set the active wallet */
  setActiveWallet: (wallet: OWSWallet | null) => void;
  /** Current policy for the active wallet */
  policy: OWSPolicy | null;
  /** Transaction history */
  transactions: Transaction[];
  /** Add a transaction to history */
  addTransaction: (tx: Transaction) => void;
  /** Refresh policy from backend */
  refreshPolicy: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook return types
// ---------------------------------------------------------------------------

export interface UseOwsWalletReturn {
  wallet: OWSWallet | null;
  balance: WalletBalance | null;
  isLoading: boolean;
  error: string | null;
  createWallet: (label?: string) => Promise<OWSWallet>;
  loadWallet: (walletId: string) => Promise<OWSWallet>;
  listWallets: () => Promise<OWSWallet[]>;
  getAddress: () => string | null;
  getBalance: () => Promise<WalletBalance>;
  refreshBalance: () => Promise<void>;
}

export interface UsePayWithOwsReturn {
  isLoading: boolean;
  error: string | null;
  lastPayment: PaymentResult | null;
  payMppChallenge: (challenge: MppChallenge) => Promise<PaymentResult>;
  payDirect: (params: DirectPayParams) => Promise<PaymentResult>;
}

export interface DirectPayParams {
  recipient: string;
  amountUsdc: number;
  memo?: string;
}

export interface UsePolicyReturn {
  policy: OWSPolicy | null;
  isLoading: boolean;
  error: string | null;
  setMaxPerTx: (amount: number) => Promise<void>;
  setDailyLimit: (amount: number) => Promise<void>;
  setAllowlist: (addresses: string[]) => Promise<void>;
  pauseWallet: () => Promise<void>;
  resumeWallet: () => Promise<void>;
  refreshPolicy: () => Promise<void>;
}
