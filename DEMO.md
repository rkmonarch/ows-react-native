# Oscar — Demo Guide & Article Outline

> This document supports the technical article:
> **"Building Autonomous Agent Payments on Mobile with Solana, USDC, and the Open Wallet Standard"**

---

## Screenshots Placeholders

Replace each placeholder with actual screenshots during your demo run.

### Screen 1 — Onboarding / Wallet Setup

```
[SCREENSHOT: OnboardingScreen.tsx]
Shows:
- "AgentPay Mobile" hero with robot emoji
- Security model card (purple left border)
- "Create New Wallet" button (purple)
- Funding guide with numbered steps
- Existing wallet list if vault has wallets
```

### Screen 2 — Dashboard

```
[SCREENSHOT: DashboardScreen.tsx]
Shows:
- Wallet card with address (tap to copy)
- USDC balance ($X.XX) and SOL balance
- OWS Policy summary (max/tx, daily limit, allowlist, status)
- Quick action buttons (Refresh, Explorer)
```

### Screen 3 — Policy Setup

```
[SCREENSHOT: PolicySetupScreen.tsx]
Shows:
- Current policy values (maxPerTx, dailyLimit, allowlist, paused)
- Input fields to update each value
- Pause/resume toggle switch
- Red-team notes (policy enforcement details)
```

### Screen 4 — Agent Demo (Running)

```
[SCREENSHOT: AgentDemoScreen.tsx — in-progress state]
Shows:
- "Research Agent" header
- Step 1 ✓ (HTTP 402 received)
- Step 2 ✓ (Challenge parsed)
- Step 3 ○ (Biometric prompt / Face ID sheet visible)
- Steps 4-6 gray (pending)
```

### Screen 5 — Agent Demo (Success)

```
[SCREENSHOT: AgentDemoScreen.tsx — success state]
Shows:
- All 6 steps with green checkmarks
- Parsed x402 challenge card (scheme, network, amount)
- Green "✅ Payment Confirmed!" result card
- Transaction signature (truncated)
- "View on Solana Explorer →" button (green)
```

### Screen 6 — Transaction History

```
[SCREENSHOT: HistoryScreen.tsx]
Shows:
- Header: "3 transactions · $0.30 USDC spent"
- Transaction rows with robot emoji (🤖) for MPP payments
- Each row: recipient (shortened), memo, amount, status (green "confirmed")
- "View on Explorer →" links
```

### Screen 7 — Solana Explorer

```
[SCREENSHOT: explorer.solana.com/tx/SIGNATURE?cluster=devnet]
Shows:
- Transaction confirmed
- USDC token transfer instruction
- Memo field with payment reference
- Devnet cluster badge
```

---

## Article Outline

### Title

**"How I Built Autonomous Agent Payments on Mobile: Open Wallet Standard + Solana + Stripe MPP"**

### Subtitle

From zero to policy-gated AI payments in a React Native app — with biometric approval, x402 parsing, and real USDC on Solana devnet.

---

### Introduction (300 words)

- The rise of AI agents that need to pay for APIs autonomously
- The problem: agents need a wallet, but phones can't hold private keys safely
- The solution: hybrid architecture — RN app + secure backend + OWS policies
- What we'll build: a React Native library + demo app

### Section 1: The x402 / MPP Standard (400 words)

- What HTTP 402 Payment Required means in 2025
- Stripe's Machine-to-Machine Payment Protocol (MPP)
- The x402 JSON format: `{ x402Version, accepts: [{ scheme, network, maxAmountRequired, payTo }] }`
- Why Solana + USDC is the ideal combination (fast, cheap, programmable)
- Code snippet: `parseMppChallenge()` function

### Section 2: Architecture — Why Hybrid? (300 words)

- Security threat model: phones get stolen, apps get reverse-engineered
- Option A: Native module (Secure Enclave) — max security, complex to build
- Option B (MVP): Backend vault + policy enforcement — ships faster, still secure
- Diagram: RN app ↔ Express backend ↔ Solana network
- Security guarantees: policies enforced server-side, keys never cross the wire

### Section 3: Building the Library (600 words)

- `OwsProvider` — React context pattern
- `useOwsWallet()` — wallet lifecycle
- `usePayWithOws()` — the payment hook, with client-side policy pre-check
- `usePolicy()` — granular spend controls
- Key design decision: `createApiClient()` abstraction so the RN side only sends intent

### Section 4: The Backend (500 words)

- Express server with 8 endpoints
- Vault design: per-wallet JSON files with `mode: 0o600`
- `enforcePolicy()` — the gatekeeper function (code walkthrough)
- `sendUsdcTransfer()` — @solana/spl-token in action
- Daily spend tracking with date rollover

### Section 5: The Example App (400 words)

- 5 screens, NativeWind styling, Expo for fast iteration
- AgentDemoScreen walkthrough: the 6-step payment flow
- Biometric approval with `expo-local-authentication`
- Screenshots (use the placeholders above)

### Section 6: Testing (300 words)

- Funding devnet wallets (faucet links)
- End-to-end test with curl
- Red-team tests: policy bypass attempts (all blocked)
- View confirmed transaction on Solana Explorer

### Section 7: What's Next (200 words)

- Native module path: TurboModules + iOS Secure Enclave
- Streaming payments (x402 streaming scheme)
- Multi-sig policy approval for large spends
- Mainnet launch checklist

### Conclusion (150 words)

- AI agents need money — this is the infrastructure layer
- OWS + MPP + Solana is the most practical stack today
- Open source — link to repo

---

## Demo Script (for video/live demo)

```
0:00  Show empty app — "No wallet yet"
0:15  Tap "Create New Wallet" → show address, explain keys stay on backend
0:30  Dashboard — show zero balances, explain devnet
0:45  Open browser → faucet.solana.com → fund with SOL
1:00  Open spl-token-faucet.com → get devnet USDC
1:15  Pull to refresh Dashboard → $5.00 USDC appears
1:30  Policy tab → set maxPerTx = $0.50, dailyLimit = $2.00
1:45  Agent tab → tap "Start Research Agent"
2:00  Watch 6 steps execute in real-time
2:10  Face ID prompt appears (biometric gate)
2:15  Approve with Face ID
2:20  Payment confirmed, explorer link appears
2:30  Tap "View on Solana Explorer" → show confirmed tx
2:45  History tab → show transaction with MPP tag
3:00  Policy tab → set maxPerTx = $0.01
3:10  Agent tab → run again → show policy rejection (>$0.50 > $0.01)
3:20  "This is OWS policy enforcement in action"
```

---

## Key Code Snippets for Article

### The 402 parser (MPP/x402)

See: `src/utils/mppParser.ts` → `parseMppChallenge()`

### The payment hook

See: `src/hooks/usePayWithOws.ts` → `payMppChallenge()`

### Backend policy enforcement

See: `backend/server.ts` → `enforcePolicy()`

### Biometric gate

See: `example/screens/AgentDemoScreen.tsx` → `LocalAuthentication.authenticateAsync()`

---

_Generated with @ows/react-native v0.1.0_
