# ows-react-native

> The first React Native library for the **Open Wallet Standard (OWS)** — policy-gated autonomous payments on Solana using USDC, with Stripe MPP / x402 HTTP 402 support.

[![npm version](https://img.shields.io/npm/v/ows-react-native.svg?style=flat-square&color=6C47FF)](https://www.npmjs.com/package/ows-react-native)
[![npm downloads](https://img.shields.io/npm/dm/ows-react-native.svg?style=flat-square)](https://www.npmjs.com/package/ows-react-native)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](./LICENSE)
[![Built for Solana](https://img.shields.io/badge/Built%20for-Solana-9945FF?style=flat-square)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)](https://www.typescriptlang.org)

**📦 [npmjs.com/package/ows-react-native](https://www.npmjs.com/package/ows-react-native)**

---

## Why this exists

The [Open Wallet Standard (OWS)](https://github.com/wallet-standard/wallet-standard) defines how wallets and apps should communicate — but there is **no official React Native implementation**. This library fills that gap.

It's designed specifically for **AI agents** that need to make autonomous micro-payments (e.g. paying for API access, model inference, data feeds) without human intervention, while keeping spending under strict policy controls.

Key problems this solves:

| Problem | This library's solution |
|---------|------------------------|
| RN apps can't safely hold private keys | Backend vault — keys never leave the server |
| Agents need to pay HTTP 402 endpoints | `parseMppChallenge()` + `payMppChallenge()` |
| No spending guardrails for autonomous agents | OWS policy engine (per-tx limit, daily cap, allowlist) |
| No standard RN wallet interface | Hooks-first API matching the OWS spec |
| Large payments need human approval | Biometric gate via `expo-local-authentication` |

---

## Features

- **`OwsProvider`** — React context with backend URL, active wallet, policies, and tx history
- **`useOwsWallet()`** — Create wallets, load from vault, get addresses and balances
- **`usePayWithOws()`** — Parse + pay HTTP 402 / x402 / MPP challenges on Solana
- **`usePolicy()`** — Set per-tx limits, daily caps, recipient allowlists, pause/resume
- **`<TransactionHistory />`** — Drop-in component for payment history
- **`parseMppChallenge()`** — Parses x402 JSON, Stripe MPP headers, and `X-Payment-Required` headers
- **Biometric approval** — Face ID / Touch ID gate for payments above your threshold
- **Full TypeScript** — Complete type coverage, zero `any` in public API
- **New Architecture ready** — Compatible with React Native's Bridgeless mode

---

## Architecture

```
┌─────────────────────────────────────────┐
│         React Native App (Oscar)        │
│                                         │
│  useOwsWallet()   usePayWithOws()       │
│  usePolicy()      <TransactionHistory/> │
│                                         │
│  OwsProvider  ──────────────────────►  │
└───────────────┬─────────────────────────┘
                │  HTTP (localhost in dev, HTTPS in prod)
                ▼
┌─────────────────────────────────────────┐
│        OWS Backend (Express)            │
│                                         │
│  POST /create-wallet  ← generates keypair
│  POST /pay-mpp        ← enforces policy │
│  POST /pay-solana-usdc                  │
│  GET  /get-balance/:id                  │
│  POST /update-policy/:id                │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  .ows/ vault (keys never leave) │   │
│  └──────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │  @solana/web3.js + @solana/spl-token
                ▼
        Solana devnet / mainnet
        USDC SPL Token transfers
```

**Security model:** Private keys are generated and stored exclusively in the backend vault (`.ows/`). The React Native app only ever receives public addresses and transaction signatures. The backend re-validates all OWS policies before signing any transaction — the client-side checks are a UX convenience only.

---

## Installation

```bash
npm install ows-react-native
```

```bash
# If using Expo, also install native dependencies:
npx expo install expo-local-authentication expo-secure-store
```

### Backend setup

The OWS backend is a standalone Express server that manages your wallet vault, enforces policies, and signs Solana transactions. Private keys **never** leave it.

```bash
# Clone the repo and start the backend
git clone https://github.com/rkmonarch/ows-react-native
cd ows-react-native/backend
npm install
npm run dev
# → Listening on http://localhost:3001
```

> Set `PORT` and `SOLANA_NETWORK` env vars to configure. Defaults to port `3001` on `devnet`.

---

## Quick Start

### 1. Wrap your app

```tsx
import { OwsProvider } from 'ows-react-native';

export default function App() {
  return (
    // In production: use HTTPS and your deployed backend URL
    <OwsProvider backendUrl="http://localhost:3001">
      <YourApp />
    </OwsProvider>
  );
}
```

### 2. Create a wallet

```tsx
import { useOwsWallet } from 'ows-react-native';

function SetupScreen() {
  const { wallet, balance, createWallet } = useOwsWallet('solana');

  return (
    <>
      <Button title="Create Wallet" onPress={() => createWallet('My Agent')} />
      {wallet && <Text>Address: {wallet.address}</Text>}
      {balance && <Text>USDC: ${balance.usdc.toFixed(2)}</Text>}
    </>
  );
}
```

### 3. Pay an x402 / MPP challenge (agent payment)

```tsx
import { usePayWithOws, parseMppChallenge } from 'ows-react-native';

function AgentScreen() {
  const { payMppChallenge, isLoading } = usePayWithOws();

  const fetchProtectedResource = async () => {
    const res = await fetch('https://api.example.com/research-results');

    if (res.status === 402) {
      // Parse the 402 challenge (x402 JSON or MPP header)
      const body = await res.json();
      const headers = Object.fromEntries(res.headers.entries());
      const challenge = parseMppChallenge(body, headers);

      // Pay it — backend checks policy, signs, sends USDC on Solana
      const result = await payMppChallenge(challenge);
      console.log('Paid!', result.explorerUrl);

      // Retry the request with payment proof
      return fetch('https://api.example.com/research-results', {
        headers: { 'X-Payment-Signature': result.signature },
      });
    }

    return res;
  };
}
```

### 4. Set spend policies

```tsx
import { usePolicy } from 'ows-react-native';

function PolicyScreen() {
  const { policy, setMaxPerTx, setDailyLimit, setAllowlist, pauseWallet } = usePolicy();

  // Limit the agent to $1.00 per payment, $10.00 per day
  await setMaxPerTx(1.00);
  await setDailyLimit(10.00);

  // Restrict to specific recipients (leave empty to allow all)
  await setAllowlist(['RecipientAddress1...', 'RecipientAddress2...']);

  // Emergency stop — blocks all payments immediately
  await pauseWallet();
}
```

### 5. Show transaction history

```tsx
import { TransactionHistory } from 'ows-react-native';

function HistoryScreen() {
  return (
    <TransactionHistory
      limit={20}
      showExplorerLink
      onTransactionPress={(tx) => console.log(tx)}
    />
  );
}
```

---

## x402 / MPP Challenge Format

This library parses all three common formats of HTTP 402 Payment Required challenges:

### Format 1 — x402 JSON body (recommended)

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "0.10",
    "payTo": "RecipientPubkey...",
    "tokenMint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "memo": "api-access-ref-123"
  }]
}
```

### Format 2 — Stripe MPP JSON body

```json
{
  "scheme": "exact",
  "network": "solana-devnet",
  "amount": "0.10",
  "recipient": "RecipientPubkey...",
  "memo": "stripe-mpp-ref-456"
}
```

### Format 3 — WWW-Authenticate MPP header

```
WWW-Authenticate: MPP realm="API", amount="0.10", recipient="PubKey...", network="solana-devnet"
```

---

## API Reference

### `OwsProvider`

```tsx
<OwsProvider
  backendUrl="http://localhost:3001"  // Required: backend URL
  maxHistorySize={50}                  // Optional: tx history limit (default: 50)
>
```

### `useOwsWallet(chain)`

```ts
const {
  wallet,          // OWSWallet | null — currently active wallet
  balance,         // WalletBalance | null — { sol, usdc, lamports, usdcRaw }
  isLoading,       // boolean
  error,           // string | null
  createWallet,    // (label?: string) => Promise<OWSWallet>
  loadWallet,      // (walletId: string) => Promise<OWSWallet>
  listWallets,     // () => Promise<OWSWallet[]>
  getAddress,      // () => string | null
  getBalance,      // () => Promise<WalletBalance>
  refreshBalance,  // () => Promise<void>
} = useOwsWallet('solana');
```

### `usePayWithOws()`

```ts
const {
  isLoading,        // boolean
  error,            // string | null
  lastPayment,      // PaymentResult | null
  payMppChallenge,  // (challenge: MppChallenge) => Promise<PaymentResult>
  payDirect,        // (params: DirectPayParams) => Promise<PaymentResult>
} = usePayWithOws();
```

**`PaymentResult`:**
```ts
{
  signature: string;      // Solana transaction signature
  explorerUrl: string;    // Full Solana Explorer URL
  amountUsdc: number;     // Amount paid
  recipient: string;      // Recipient address
  timestamp: string;      // ISO-8601
  memo?: string;          // Memo attached to transaction
}
```

### `usePolicy()`

```ts
const {
  policy,         // OWSPolicy | null
  isLoading,      // boolean
  error,          // string | null
  setMaxPerTx,    // (amount: number) => Promise<void>
  setDailyLimit,  // (amount: number) => Promise<void>
  setAllowlist,   // (addresses: string[]) => Promise<void>
  pauseWallet,    // () => Promise<void>
  resumeWallet,   // () => Promise<void>
  refreshPolicy,  // () => Promise<void>
} = usePolicy();
```

**`OWSPolicy`:**
```ts
{
  maxPerTx: number;                    // Max USDC per transaction
  dailyLimit: number;                  // Rolling 24h cap in USDC
  allowlist: string[];                 // Empty = allow all recipients
  paused: boolean;                     // Kill-switch
  merchantLimits?: Record<string, number>; // Per-address limits
}
```

### `parseMppChallenge(body, headers)`

```ts
import { parseMppChallenge } from 'ows-react-native';

const challenge: MppChallenge = parseMppChallenge(
  responseBody,   // Record<string, unknown> | null
  responseHeaders // Record<string, string>
);
// Throws if format is unrecognised
```

---

## Backend API

The included Express backend exposes these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status + network info |
| `POST` | `/create-wallet` | Generate new Solana keypair, store in vault |
| `GET` | `/list-wallets` | List all vault wallets (no secret keys) |
| `GET` | `/get-balance/:id` | SOL + USDC balance on-chain |
| `GET` | `/get-policy/:id` | Current OWS policy for wallet |
| `POST` | `/update-policy/:id` | Update policy fields |
| `POST` | `/pay-solana-usdc` | Direct USDC transfer (policy-gated) |
| `POST` | `/pay-mpp` | Pay an x402/MPP challenge (policy-gated) |
| `POST` | `/mock-402` | **Dev only** — returns a test 402 challenge |

### Backend environment variables

```bash
# backend/.env
PORT=3001
SOLANA_NETWORK=devnet        # or mainnet-beta
VAULT_DIR=./.ows             # path to encrypted key vault
```

---

## Solana Constants

| Network | USDC Mint Address |
|---------|------------------|
| **Devnet** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| **Mainnet** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

---

## Funding Devnet Wallets (Testing)

1. **SOL** (for transaction fees): [faucet.solana.com](https://faucet.solana.com)
2. **USDC** (devnet): [spl-token-faucet.com](https://spl-token-faucet.com/?token-name=USDC-Dev)
3. **Verify**: [explorer.solana.com](https://explorer.solana.com/?cluster=devnet)

---

## End-to-End Test (curl)

```bash
# 1. Start the backend
cd backend && npm run dev

# 2. Create a wallet
curl -X POST http://localhost:3001/create-wallet \
  -H "Content-Type: application/json" \
  -d '{"label":"test-agent"}'
# → { "wallet": { "id": "...", "address": "...", "chain": "solana" } }

# 3. Set policies
curl -X POST http://localhost:3001/update-policy/<WALLET_ID> \
  -H "Content-Type: application/json" \
  -d '{"maxPerTx": 0.50, "dailyLimit": 5.00}'

# 4. Get a mock 402 challenge
curl -X POST http://localhost:3001/mock-402 \
  -H "Content-Type: application/json" \
  -d '{"amount":"0.10"}'
# → HTTP 402 with x402 JSON body

# 5. Pay the challenge
curl -X POST http://localhost:3001/pay-mpp \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "<WALLET_ID>",
    "challenge": { "recipient": "<ADDRESS>", "amountFloat": 0.10 }
  }'
# → { "result": { "signature": "...", "explorerUrl": "..." } }

# 6. View on Explorer
open "https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet"
```

### Policy enforcement tests (red-team)

```bash
# Exceed maxPerTx — should return 403
curl -X POST http://localhost:3001/pay-solana-usdc \
  -d '{"walletId":"<ID>","recipient":"<ADDR>","amountUsdc":100}'
# → 403 { "message": "Amount $100.00 exceeds maxPerTx limit of $0.50" }

# Blocked recipient (allowlist active)
curl -X POST http://localhost:3001/update-policy/<ID> \
  -d '{"allowlist":["<ALLOWED_ADDR>"]}'
curl -X POST http://localhost:3001/pay-solana-usdc \
  -d '{"walletId":"<ID>","recipient":"<OTHER_ADDR>","amountUsdc":0.01}'
# → 403 { "message": "Recipient ... is not on the allowlist" }

# Paused wallet
curl -X POST http://localhost:3001/update-policy/<ID> -d '{"paused":true}'
curl -X POST http://localhost:3001/pay-solana-usdc \
  -d '{"walletId":"<ID>","recipient":"<ADDR>","amountUsdc":0.01}'
# → 403 { "message": "Wallet is paused — no payments allowed" }
```

---

## Security

> ⚠️ **Read before deploying to production**

### What is safe
- ✅ Public addresses are safe to share (they're on the blockchain)
- ✅ Transaction signatures are safe to expose
- ✅ Policy configs are safe to send over HTTP

### What must be protected
- 🔐 **`.ows/` directory** — contains private keys. Never commit it. Add to `.gitignore`.
- 🔐 **Backend API** — in production, add `Authorization: Bearer <token>` header authentication
- 🔐 **HTTPS** — run the backend behind TLS in production (NGINX, Caddy, etc.)
- 🔐 **Vault encryption** — for production, replace plain JSON files with AWS KMS, HashiCorp Vault, or a TEE/HSM

### Policy enforcement
All policies are **enforced server-side** before any signing. The client-side pre-checks in hooks are UX convenience only — a malicious client cannot bypass them by directly calling the backend without a valid walletId and passing the same policy checks.

### Private key isolation
The `/create-wallet` endpoint returns only `{ id, address, chain, label, createdAt }`. The `secretKey` field is stripped before the response is sent. No endpoint ever returns a private key.

---

## Roadmap

- [ ] Native module path — TurboModules + iOS Secure Enclave for on-device signing
- [ ] Streaming payments — x402 streaming scheme support
- [ ] Multi-sig policy approval for spends above threshold
- [ ] Persistent transaction history via `expo-sqlite`
- [ ] Push notifications on payment confirmation
- [ ] EVM support (`chain: 'base'` | `'ethereum'`)
- [ ] Mainnet launch checklist and audit

---

## Project Structure

```
ows-react-native/
├── src/                          # Library source (TypeScript)
│   ├── index.ts                  # Public API exports
│   ├── types.ts                  # All TypeScript types
│   ├── components/
│   │   ├── OwsProvider.tsx       # React context + provider
│   │   └── TransactionHistory.tsx
│   ├── hooks/
│   │   ├── useOwsWallet.ts       # Wallet lifecycle
│   │   ├── usePayWithOws.ts      # Payment hook
│   │   └── usePolicy.ts          # Policy management
│   └── utils/
│       ├── mppParser.ts          # x402 / MPP challenge parser
│       └── apiClient.ts          # Typed fetch wrapper
├── backend/
│   ├── server.ts                 # Express server (wallet vault + Solana)
│   └── package.json
├── example/                      # Oscar — full Expo demo app
│   ├── App.tsx
│   ├── theme.ts                  # Design tokens
│   └── screens/
│       ├── OnboardingScreen.tsx
│       ├── DashboardScreen.tsx
│       ├── PolicySetupScreen.tsx
│       ├── AgentDemoScreen.tsx
│       └── HistoryScreen.tsx
└── lib/                          # Built output (commonjs + module + types)
```

---

## Contributing

Pull requests welcome. For major changes, open an issue first.

```bash
git clone https://github.com/rkmonarch/ows-react-native
cd ows-react-native
npm install
cd backend && npm install
npm run typecheck   # type-check library
```

---

## Related

- [Wallet Standard](https://github.com/wallet-standard/wallet-standard) — the specification this implements
- [Stripe MPP](https://stripe.com/blog/machine-to-machine-payments) — Machine-to-Machine Payment Protocol
- [@solana/spl-token](https://github.com/solana-labs/solana-program-library) — USDC transfers
- [Solana devnet faucet](https://faucet.solana.com)

---

## License

MIT © [rkmonarch](https://github.com/rkmonarch)
