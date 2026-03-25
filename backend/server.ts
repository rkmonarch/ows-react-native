/**
 * OWS Backend Server
 *
 * Express server that manages the OWS wallet vault, enforces spend policies,
 * and handles Solana USDC signing. Private keys NEVER leave this process.
 *
 * Architecture note:
 *   In a real production deployment this would use @wallet-standard/core
 *   (the canonical Wallet Standard SDK) with a hardware HSM or TEE for key
 *   storage. For this MVP we use nacl keypairs stored in ./.ows (encrypted
 *   at rest in production — see README security notes).
 *
 * Endpoints:
 *   GET  /health
 *   POST /create-wallet
 *   GET  /list-wallets
 *   GET  /get-balance/:walletId
 *   GET  /get-policy/:walletId
 *   POST /update-policy/:walletId
 *   POST /pay-solana-usdc
 *   POST /pay-mpp
 *   POST /mock-402         ← for local testing
 *
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Solana
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction as SolanaTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3001', 10);
const NETWORK = (process.env.SOLANA_NETWORK || 'devnet') as
  | 'devnet'
  | 'mainnet-beta';
const VAULT_DIR = path.resolve(process.env.VAULT_DIR || './.ows');

// USDC mint addresses
const USDC_MINT: Record<string, string> = {
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const SOLANA_EXPLORER_BASE: Record<string, string> = {
  devnet: 'https://explorer.solana.com/tx/',
  'mainnet-beta': 'https://explorer.solana.com/tx/',
};

const explorerCluster = NETWORK === 'devnet' ? '?cluster=devnet' : '';

// ---------------------------------------------------------------------------
// Solana connection
// ---------------------------------------------------------------------------

const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
console.log(`[OWS] Connected to Solana ${NETWORK}`);

// ---------------------------------------------------------------------------
// Vault — stores keypairs + policies as JSON files
// ---------------------------------------------------------------------------

interface VaultWallet {
  id: string;
  address: string;
  chain: 'solana';
  label?: string;
  createdAt: string;
  /** Base58-encoded secret key — NEVER returned to RN clients */
  secretKey: string;
}

interface VaultPolicy {
  maxPerTx: number;
  dailyLimit: number;
  allowlist: string[];
  paused: boolean;
  merchantLimits: Record<string, number>;
  /** Tracks daily spend — { date: 'YYYY-MM-DD', spent: number } */
  dailySpend: { date: string; spent: number };
}

function ensureVaultDir(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
    console.log(`[OWS] Created vault at ${VAULT_DIR}`);
  }
}

function walletPath(id: string): string {
  return path.join(VAULT_DIR, `wallet_${id}.json`);
}

function policyPath(id: string): string {
  return path.join(VAULT_DIR, `policy_${id}.json`);
}

function readWallet(id: string): VaultWallet | null {
  const p = walletPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as VaultWallet;
}

function writeWallet(wallet: VaultWallet): void {
  fs.writeFileSync(walletPath(wallet.id), JSON.stringify(wallet, null, 2), {
    mode: 0o600, // Owner read/write only
  });
}

function defaultPolicy(): VaultPolicy {
  return {
    maxPerTx: 1.0,
    dailyLimit: 10.0,
    allowlist: [],
    paused: false,
    merchantLimits: {},
    dailySpend: { date: todayDate(), spent: 0 },
  };
}

function readPolicy(id: string): VaultPolicy {
  const p = policyPath(id);
  if (!fs.existsSync(p)) return defaultPolicy();
  return JSON.parse(fs.readFileSync(p, 'utf8')) as VaultPolicy;
}

function writePolicy(id: string, policy: VaultPolicy): void {
  fs.writeFileSync(policyPath(id), JSON.stringify(policy, null, 2), {
    mode: 0o600,
  });
}

function listVaultWallets(): VaultWallet[] {
  ensureVaultDir();
  return fs
    .readdirSync(VAULT_DIR)
    .filter((f) => f.startsWith('wallet_') && f.endsWith('.json'))
    .map((f) => {
      const full = path.join(VAULT_DIR, f);
      return JSON.parse(fs.readFileSync(full, 'utf8')) as VaultWallet;
    });
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Strip secret key before sending to client */
function sanitizeWallet(w: VaultWallet) {
  const { secretKey: _sk, ...safe } = w;
  return safe;
}

// ---------------------------------------------------------------------------
// Policy enforcement
// ---------------------------------------------------------------------------

function enforcePolicy(
  policy: VaultPolicy,
  amountUsdc: number,
  recipient: string
): void {
  if (policy.paused) {
    throw new PolicyError('Wallet is paused — no payments allowed');
  }

  if (amountUsdc > policy.maxPerTx) {
    throw new PolicyError(
      `Amount $${amountUsdc.toFixed(2)} exceeds maxPerTx limit of $${policy.maxPerTx.toFixed(2)}`
    );
  }

  // Reset daily spend if it's a new day
  if (policy.dailySpend.date !== todayDate()) {
    policy.dailySpend = { date: todayDate(), spent: 0 };
  }

  const projectedDaily = policy.dailySpend.spent + amountUsdc;
  if (projectedDaily > policy.dailyLimit) {
    throw new PolicyError(
      `Payment would exceed daily limit of $${policy.dailyLimit.toFixed(2)}. ` +
        `Already spent: $${policy.dailySpend.spent.toFixed(2)}`
    );
  }

  if (policy.allowlist.length > 0 && !policy.allowlist.includes(recipient)) {
    throw new PolicyError(
      `Recipient ${recipient} is not on the allowlist`
    );
  }

  if (
    policy.merchantLimits[recipient] !== undefined &&
    amountUsdc > policy.merchantLimits[recipient]
  ) {
    throw new PolicyError(
      `Amount $${amountUsdc.toFixed(2)} exceeds merchant limit of $${policy.merchantLimits[recipient]!.toFixed(2)}`
    );
  }
}

class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyError';
  }
}

// ---------------------------------------------------------------------------
// Solana USDC transfer
// ---------------------------------------------------------------------------

async function sendUsdcTransfer(params: {
  fromKeypair: Keypair;
  toAddress: string;
  amountUsdc: number;
  memo?: string;
}): Promise<string> {
  const { fromKeypair, toAddress, amountUsdc, memo } = params;

  const mintAddress = new PublicKey(USDC_MINT[NETWORK]!);
  const toPublicKey = new PublicKey(toAddress);

  // Get mint info to determine decimals (USDC = 6)
  const mintInfo = await getMint(connection, mintAddress);
  const rawAmount = BigInt(Math.round(amountUsdc * 10 ** mintInfo.decimals));

  // Get or create sender ATA
  const fromAta = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeypair,
    mintAddress,
    fromKeypair.publicKey
  );

  // Get or create recipient ATA
  const toAta = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeypair, // payer for account creation
    mintAddress,
    toPublicKey
  );

  // Build transfer instruction
  const tx = new SolanaTransaction();

  if (memo) {
    // Add memo instruction (SPL Memo program)
    const MEMO_PROGRAM_ID = new PublicKey(
      'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
    );
    tx.add({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, 'utf8'),
    });
  }

  tx.add(
    createTransferInstruction(
      fromAta.address,
      toAta.address,
      fromKeypair.publicKey,
      rawAmount
    )
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [fromKeypair]);
  return signature;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[OWS] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET /health */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    network: NETWORK,
    usdcMint: USDC_MINT[NETWORK],
    vaultDir: VAULT_DIR,
  });
});

// ---------------------------------------------------------------------------
/** POST /create-wallet */
app.post('/create-wallet', (req: Request, res: Response) => {
  ensureVaultDir();

  const label = (req.body as { label?: string }).label;
  const keypair = Keypair.generate();
  const id = uuidv4();

  const vault: VaultWallet = {
    id,
    address: keypair.publicKey.toBase58(),
    chain: 'solana',
    label,
    createdAt: new Date().toISOString(),
    secretKey: bs58.encode(keypair.secretKey),
  };

  writeWallet(vault);
  writePolicy(id, defaultPolicy());

  console.log(`[OWS] Created wallet ${id} → ${vault.address}`);
  res.status(201).json({ wallet: sanitizeWallet(vault) });
});

// ---------------------------------------------------------------------------
/** GET /list-wallets */
app.get('/list-wallets', (_req: Request, res: Response) => {
  const wallets = listVaultWallets().map(sanitizeWallet);
  res.json({ wallets });
});

// ---------------------------------------------------------------------------
/** GET /get-balance/:walletId */
app.get('/get-balance/:walletId', async (req: Request, res: Response) => {
  const wallet = readWallet(req.params.walletId!);
  if (!wallet) {
    res.status(404).json({ message: 'Wallet not found' });
    return;
  }

  const pubkey = new PublicKey(wallet.address);

  // SOL balance
  const lamports = await connection.getBalance(pubkey);
  const sol = lamports / 1e9;

  // USDC balance
  let usdcRaw = 0;
  let usdc = 0;
  try {
    const mintAddress = new PublicKey(USDC_MINT[NETWORK]!);
    const ata = await getAssociatedTokenAddress(mintAddress, pubkey);
    const accountInfo = await connection.getTokenAccountBalance(ata);
    usdcRaw = parseInt(accountInfo.value.amount, 10);
    usdc = parseFloat(accountInfo.value.uiAmountString ?? '0');
  } catch {
    // ATA doesn't exist yet — wallet has 0 USDC
  }

  res.json({ balance: { sol, lamports, usdc, usdcRaw } });
});

// ---------------------------------------------------------------------------
/** GET /get-policy/:walletId */
app.get('/get-policy/:walletId', (req: Request, res: Response) => {
  if (!readWallet(req.params.walletId!)) {
    res.status(404).json({ message: 'Wallet not found' });
    return;
  }
  const policy = readPolicy(req.params.walletId!);
  // Don't expose internal dailySpend tracking to client
  const { dailySpend: _ds, ...clientPolicy } = policy;
  res.json({ policy: clientPolicy });
});

// ---------------------------------------------------------------------------
/** POST /update-policy/:walletId */
app.post('/update-policy/:walletId', (req: Request, res: Response) => {
  if (!readWallet(req.params.walletId!)) {
    res.status(404).json({ message: 'Wallet not found' });
    return;
  }
  const current = readPolicy(req.params.walletId!);
  const updates = req.body as Partial<VaultPolicy>;

  // Merge — only update provided fields
  if (updates.maxPerTx !== undefined) current.maxPerTx = updates.maxPerTx;
  if (updates.dailyLimit !== undefined) current.dailyLimit = updates.dailyLimit;
  if (updates.allowlist !== undefined) current.allowlist = updates.allowlist;
  if (updates.paused !== undefined) current.paused = updates.paused;
  if (updates.merchantLimits !== undefined)
    current.merchantLimits = updates.merchantLimits;

  writePolicy(req.params.walletId!, current);
  const { dailySpend: _ds, ...clientPolicy } = current;
  res.json({ policy: clientPolicy });
});

// ---------------------------------------------------------------------------
/** POST /pay-solana-usdc — direct USDC payment */
app.post('/pay-solana-usdc', async (req: Request, res: Response) => {
  const { walletId, recipient, amountUsdc, memo } = req.body as {
    walletId: string;
    recipient: string;
    amountUsdc: number;
    memo?: string;
  };

  const vault = readWallet(walletId);
  if (!vault) {
    res.status(404).json({ message: 'Wallet not found' });
    return;
  }

  // Validate recipient
  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(recipient);
    void recipientPubkey; // suppress unused warning
  } catch {
    res.status(400).json({ message: 'Invalid recipient address' });
    return;
  }

  // Load policy and enforce
  const policy = readPolicy(walletId);
  try {
    enforcePolicy(policy, amountUsdc, recipient);
  } catch (err) {
    if (err instanceof PolicyError) {
      res.status(403).json({ message: err.message, code: 'POLICY_VIOLATION' });
      return;
    }
    throw err;
  }

  // Reconstruct keypair from vault (keys never leave this process)
  const secretKeyBytes = bs58.decode(vault.secretKey);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);

  try {
    const signature = await sendUsdcTransfer({
      fromKeypair: keypair,
      toAddress: recipient,
      amountUsdc,
      memo,
    });

    // Update daily spend tracking
    if (policy.dailySpend.date !== todayDate()) {
      policy.dailySpend = { date: todayDate(), spent: 0 };
    }
    policy.dailySpend.spent += amountUsdc;
    writePolicy(walletId, policy);

    const explorerUrl = `${SOLANA_EXPLORER_BASE[NETWORK]}${signature}${explorerCluster}`;

    res.json({
      result: {
        signature,
        explorerUrl,
        amountUsdc,
        recipient,
        timestamp: new Date().toISOString(),
        memo,
      },
    });
  } catch (err) {
    console.error('[OWS] Transfer failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: `Transfer failed: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
/** POST /pay-mpp — pay a parsed x402/MPP challenge */
app.post('/pay-mpp', async (req: Request, res: Response) => {
  const { walletId, challenge } = req.body as {
    walletId: string;
    challenge: {
      recipient: string;
      amountFloat: number;
      memo?: string;
      reference?: string;
    };
  };

  if (!challenge || !challenge.recipient) {
    res.status(400).json({ message: 'Missing challenge.recipient' });
    return;
  }

  const memo = challenge.memo || challenge.reference;

  // Delegate to the direct pay handler logic
  req.body = {
    walletId,
    recipient: challenge.recipient,
    amountUsdc: challenge.amountFloat,
    memo,
  };

  // Reuse the /pay-solana-usdc handler by calling it internally
  // (In production, extract shared logic into a service layer)
  const vault = readWallet(walletId);
  if (!vault) {
    res.status(404).json({ message: 'Wallet not found' });
    return;
  }

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(challenge.recipient);
    void recipientPubkey;
  } catch {
    res.status(400).json({ message: 'Invalid recipient address in challenge' });
    return;
  }

  const policy = readPolicy(walletId);
  try {
    enforcePolicy(policy, challenge.amountFloat, challenge.recipient);
  } catch (err) {
    if (err instanceof PolicyError) {
      res.status(403).json({ message: err.message, code: 'POLICY_VIOLATION' });
      return;
    }
    throw err;
  }

  const secretKeyBytes = bs58.decode(vault.secretKey);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);

  try {
    const signature = await sendUsdcTransfer({
      fromKeypair: keypair,
      toAddress: challenge.recipient,
      amountUsdc: challenge.amountFloat,
      memo,
    });

    if (policy.dailySpend.date !== todayDate()) {
      policy.dailySpend = { date: todayDate(), spent: 0 };
    }
    policy.dailySpend.spent += challenge.amountFloat;
    writePolicy(walletId, policy);

    const explorerUrl = `${SOLANA_EXPLORER_BASE[NETWORK]}${signature}${explorerCluster}`;

    res.json({
      result: {
        signature,
        explorerUrl,
        amountUsdc: challenge.amountFloat,
        recipient: challenge.recipient,
        timestamp: new Date().toISOString(),
        memo,
      },
    });
  } catch (err) {
    console.error('[OWS] MPP payment failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message: `MPP payment failed: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
/** POST /mock-402 — returns a mock 402 challenge for local testing */
app.post('/mock-402', (req: Request, res: Response) => {
  const amount = (req.body as { amount?: string }).amount || '0.10';
  // If no recipient provided, use the first vault wallet (self-payment test)
  let recipient = (req.body as { recipient?: string }).recipient;
  if (!recipient) {
    const wallets = listVaultWallets();
    recipient = wallets.length > 0 ? wallets[0]!.address : null;
  }
  if (!recipient) {
    res.status(400).json({
      message: 'No recipient provided and no wallets in vault. Create a wallet first.',
    });
    return;
  }

  // Return a proper 402 with x402-compliant body
  res.status(402).json({
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: `solana-${NETWORK}`,
        maxAmountRequired: amount,
        payTo: recipient,
        tokenMint: USDC_MINT[NETWORK],
        memo: `mock-research-agent-${Date.now()}`,
        reference: `ref-${uuidv4()}`,
        resource: '/api/research-results',
        description: 'Access to AI research agent results',
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[OWS] Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', detail: err.message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

ensureVaultDir();
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║       OWS Backend Server — Running       ║
╠══════════════════════════════════════════╣
║  Port:    ${PORT}                             ║
║  Network: ${NETWORK.padEnd(30)} ║
║  Vault:   ${VAULT_DIR.slice(-30).padEnd(30)} ║
╚══════════════════════════════════════════╝

⚠️  SECURITY: .ows/ vault contains private keys.
    Add .ows/ to .gitignore. Use encrypted storage in production.

Ready. Listening on http://localhost:${PORT}
  `);
});

export default app;
