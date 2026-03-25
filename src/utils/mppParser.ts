/**
 * MPP / x402 Challenge Parser
 *
 * Parses HTTP 402 Payment Required responses following the
 * Stripe Machine-to-Machine Payment Protocol (MPP) and the
 * emerging x402 standard.
 *
 * Reference: https://stripe.com/blog/machine-to-machine-payments
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import type { MppChallenge } from '../types';

// Solana devnet USDC mint
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
// Solana mainnet USDC mint
const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Parse a raw HTTP 402 response body or headers into a structured MppChallenge.
 *
 * Supports two formats:
 * 1. x402 JSON body: { x402Version, accepts: [{ scheme, network, maxAmountRequired, ... }] }
 * 2. Stripe MPP header: WWW-Authenticate: MPP realm="...", amount="...", recipient="..."
 *
 * @param responseBody  Parsed JSON body from the 402 response (may be null)
 * @param headers       Response headers as a plain object
 * @returns             Parsed MppChallenge or throws if unparseable
 */
export function parseMppChallenge(
  responseBody: Record<string, unknown> | null,
  headers: Record<string, string> = {}
): MppChallenge {
  // --- Try x402 JSON format first ---
  if (responseBody && responseBody['x402Version']) {
    return parseX402Body(responseBody);
  }

  // --- Try Stripe MPP body format ---
  if (responseBody && responseBody['scheme'] === 'exact') {
    return parseStripeMppBody(responseBody);
  }

  // --- Try WWW-Authenticate header ---
  const wwwAuth =
    headers['www-authenticate'] || headers['WWW-Authenticate'] || '';
  if (wwwAuth.toLowerCase().startsWith('mpp ')) {
    return parseMppHeader(wwwAuth, headers);
  }

  // --- Try X-Payment-Required header (some implementations) ---
  const xPayment =
    headers['x-payment-required'] || headers['X-Payment-Required'] || '';
  if (xPayment) {
    try {
      const parsed = JSON.parse(xPayment) as Record<string, unknown>;
      return parseX402Body(parsed);
    } catch {
      // fall through to error
    }
  }

  throw new Error(
    'Unable to parse 402 challenge: unrecognized format. ' +
      'Expected x402 JSON body or MPP WWW-Authenticate header.'
  );
}

// ---------------------------------------------------------------------------
// x402 JSON body parser
// Format: { x402Version: 1, accepts: [{ scheme, network, maxAmountRequired, resource, ... }] }
// ---------------------------------------------------------------------------

function parseX402Body(body: Record<string, unknown>): MppChallenge {
  const accepts = body['accepts'] as Array<Record<string, unknown>> | undefined;

  if (!accepts || accepts.length === 0) {
    throw new Error('x402 body missing "accepts" array');
  }

  // Prefer Solana / USDC option
  const offer =
    accepts.find(
      (a) =>
        typeof a['network'] === 'string' &&
        (a['network'] as string).includes('solana')
    ) || accepts[0];

  if (!offer) throw new Error('No payment offer found in x402 accepts');

  const network = (offer['network'] as string) || 'solana-devnet';
  const scheme = (offer['scheme'] as string) || 'exact';

  // maxAmountRequired can be a string like "0.10" or number
  const rawAmount = offer['maxAmountRequired'] as string | number | undefined;
  const amountFloat = rawAmount ? parseFloat(String(rawAmount)) : 0;

  const recipient = (offer['payTo'] as string) || (offer['recipient'] as string) || '';
  const tokenMint =
    (offer['tokenMint'] as string) ||
    (network.includes('mainnet') ? MAINNET_USDC_MINT : DEVNET_USDC_MINT);

  return {
    scheme,
    network,
    recipient,
    amount: String(amountFloat.toFixed(6)),
    amountFloat,
    tokenMint,
    memo: offer['memo'] as string | undefined,
    reference: offer['reference'] as string | undefined,
    raw: body,
  };
}

// ---------------------------------------------------------------------------
// Stripe MPP body parser
// Format: { scheme: "exact", network: "solana-devnet", amount: "0.10", recipient: "..." }
// ---------------------------------------------------------------------------

function parseStripeMppBody(body: Record<string, unknown>): MppChallenge {
  const amount = String(body['amount'] || '0');
  const amountFloat = parseFloat(amount);
  const network = (body['network'] as string) || 'solana-devnet';
  const tokenMint =
    (body['tokenMint'] as string) ||
    (network.includes('mainnet') ? MAINNET_USDC_MINT : DEVNET_USDC_MINT);

  if (!body['recipient']) {
    throw new Error('MPP body missing "recipient" field');
  }

  return {
    scheme: body['scheme'] as string,
    network,
    recipient: body['recipient'] as string,
    amount,
    amountFloat,
    tokenMint,
    memo: body['memo'] as string | undefined,
    reference: body['reference'] as string | undefined,
    raw: body,
  };
}

// ---------------------------------------------------------------------------
// WWW-Authenticate MPP header parser
// Format: MPP realm="...", amount="0.10", recipient="...", network="solana-devnet"
// ---------------------------------------------------------------------------

function parseMppHeader(
  header: string,
  _headers: Record<string, string>
): MppChallenge {
  // Strip "MPP " prefix
  const params = header.replace(/^MPP\s+/i, '');

  // Parse key="value" pairs
  const kvPairs: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(params)) !== null) {
    kvPairs[match[1]] = match[2];
  }

  const amount = kvPairs['amount'] || '0';
  const amountFloat = parseFloat(amount);
  const network = kvPairs['network'] || 'solana-devnet';
  const tokenMint =
    kvPairs['tokenMint'] ||
    (network.includes('mainnet') ? MAINNET_USDC_MINT : DEVNET_USDC_MINT);

  if (!kvPairs['recipient']) {
    throw new Error('MPP WWW-Authenticate header missing "recipient" param');
  }

  return {
    scheme: kvPairs['scheme'] || 'exact',
    network,
    recipient: kvPairs['recipient'],
    amount,
    amountFloat,
    tokenMint,
    memo: kvPairs['memo'],
    reference: kvPairs['reference'],
    raw: kvPairs as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock 402 challenge for local testing.
 * Simulates what a real 402-protected API would return.
 */
export function buildMockChallenge(overrides?: Partial<MppChallenge>): MppChallenge {
  return {
    scheme: 'exact',
    network: 'solana-devnet',
    recipient: 'REPLACE_WITH_MERCHANT_PUBKEY',
    amount: '0.10',
    amountFloat: 0.1,
    tokenMint: DEVNET_USDC_MINT,
    memo: 'mock-agent-payment-001',
    reference: `ref-${Date.now()}`,
    raw: { mock: true },
    ...overrides,
  };
}

/**
 * Validate that a challenge passes basic sanity checks before sending.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateChallenge(challenge: MppChallenge): string | null {
  if (!challenge.recipient || challenge.recipient.length < 32) {
    return 'Invalid recipient address';
  }
  if (challenge.amountFloat <= 0) {
    return 'Amount must be greater than 0';
  }
  if (challenge.amountFloat > 1000) {
    return 'Amount exceeds safety limit of $1000 USDC';
  }
  if (!challenge.tokenMint) {
    return 'Missing token mint address';
  }
  return null;
}
