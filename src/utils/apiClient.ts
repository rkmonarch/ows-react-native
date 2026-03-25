/**
 * API Client — thin wrapper over fetch for communicating with the OWS backend.
 *
 * The React Native app NEVER holds private keys. All signing happens on the
 * backend. This client talks to the Express server via HTTP.
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

export class OwsApiError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'OwsApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Internal fetch wrapper with JSON handling and error normalization.
 */
async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const err = body as Record<string, unknown> | null;
    throw new OwsApiError(
      (err?.message as string) || `HTTP ${response.status}`,
      response.status,
      err?.code as string | undefined
    );
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Typed API methods
// ---------------------------------------------------------------------------

export function createApiClient(backendUrl: string) {
  const baseUrl = backendUrl.replace(/\/$/, ''); // strip trailing slash

  return {
    /** Create a new OWS wallet on the backend */
    createWallet: (label?: string) =>
      apiFetch<{ wallet: import('../types').OWSWallet }>(baseUrl, '/create-wallet', {
        method: 'POST',
        body: JSON.stringify({ label }),
      }),

    /** List all wallets in the vault */
    listWallets: () =>
      apiFetch<{ wallets: import('../types').OWSWallet[] }>(baseUrl, '/list-wallets'),

    /** Get SOL + USDC balance for a wallet */
    getBalance: (walletId: string) =>
      apiFetch<{ balance: import('../types').WalletBalance }>(
        baseUrl,
        `/get-balance/${walletId}`
      ),

    /** Get the OWS policy for a wallet */
    getPolicy: (walletId: string) =>
      apiFetch<{ policy: import('../types').OWSPolicy }>(
        baseUrl,
        `/get-policy/${walletId}`
      ),

    /** Update the OWS policy for a wallet */
    updatePolicy: (
      walletId: string,
      updates: import('../types').PolicyUpdateRequest
    ) =>
      apiFetch<{ policy: import('../types').OWSPolicy }>(
        baseUrl,
        `/update-policy/${walletId}`,
        {
          method: 'POST',
          body: JSON.stringify(updates),
        }
      ),

    /** Pay a parsed MPP/x402 challenge */
    payMpp: (
      walletId: string,
      challenge: import('../types').MppChallenge
    ) =>
      apiFetch<{ result: import('../types').PaymentResult }>(baseUrl, '/pay-mpp', {
        method: 'POST',
        body: JSON.stringify({ walletId, challenge }),
      }),

    /** Direct USDC payment (no challenge) */
    paySolanaUsdc: (params: {
      walletId: string;
      recipient: string;
      amountUsdc: number;
      memo?: string;
    }) =>
      apiFetch<{ result: import('../types').PaymentResult }>(
        baseUrl,
        '/pay-solana-usdc',
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      ),

    /** Health check */
    health: () => apiFetch<{ status: string; version: string }>(baseUrl, '/health'),
  };
}

export type OWSApiClient = ReturnType<typeof createApiClient>;
