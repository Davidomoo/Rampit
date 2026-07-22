# ▲ RAMPIT — Africa's Crypto Onramp

> **Buy crypto. Pay local. No bank drama, no delays.**

Rampit is a peer-to-peer crypto onramp built for Africa. It lets users in Nigeria, Ghana, and Kenya convert their local fiat currency (NGN, GHS, KES) into cryptocurrency by making a simple local bank transfer — no foreign exchange accounts, no complex KYC for small orders, and no waiting days for settlement.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Supported Currencies & Tokens](#supported-currencies--tokens)
- [Features](#features)
- [Pages & Screens](#pages--screens)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment & Configuration](#environment--configuration)
- [KYC & Compliance](#kyc--compliance)
- [Security](#security)

---

## Overview

Rampit bridges the gap between African fiat currencies and the global crypto economy. The core flow is intentionally simple:

1. A user selects their local currency and the crypto token they want.
2. They enter an amount and their wallet address.
3. Rampit shows them a local bank account to pay into (escrow).
4. Once the transfer is confirmed, crypto is released to their wallet — typically within 5 minutes.

There are no third-party payment processors, no card fees, and no need for a foreign bank account. Everything runs through local bank infrastructure that users already trust.

---

## How It Works

### Step 1 — Choose Currency & Token
The user picks their fiat currency (NGN, GHS, or KES), enters the amount they want to spend, and selects the crypto token they want to receive. The platform calculates the exact crypto amount in real time, factoring in the current exchange rate and a small network fee.

### Step 2 — Send Fiat to Escrow
Rampit displays a local bank account (per country) for the user to transfer their fiat to. The user has **30 minutes** to complete the bank transfer. The bank details are specific to the selected currency:

| Currency | Bank | Account Name |
|----------|------|--------------|
| NGN | Providus Bank | RAMPIT ESCROW LTD |
| GHS | Ecobank Ghana | RAMPIT ESCROW LTD |
| KES | Equity Bank KE | RAMPIT ESCROW LTD |

### Step 3 — Receive Crypto Instantly
Once the fiat transfer is confirmed, Rampit releases the crypto directly to the user's wallet. Settlement typically completes in under 5 minutes.

---

## Supported Currencies & Tokens

### Fiat Currencies
| Currency | Symbol | Country |
|----------|--------|---------|
| NGN | ₦ | Nigeria |
| GHS | ₵ | Ghana |
| KES | KSh | Kenya |

### Crypto Tokens
| Token | Name | Supported Networks |
|-------|------|--------------------|
| USDT | Tether | TRC-20, ERC-20, BEP-20 |
| USDC | USD Coin | ERC-20, BEP-20 |
| CELO | Celo | Celo Network |
| SOL | Solana | Solana |
| XLM | Stellar | Stellar |

### Minimum Order Amounts
| Currency | Minimum |
|----------|---------|
| NGN | ₦1,000 |
| GHS | ₵10 |
| KES | KSh 130 |

### Network Fees
| Currency | Fee |
|----------|-----|
| NGN | ₦500 |
| GHS | ₵5 |
| KES | KSh 65 |

---

## Features

### Core
- **Real-time rate calculation** — crypto amounts update instantly as the user types, using live USD exchange rates per fiat currency.
- **Wallet address validation** — each network has a strict regex pattern to catch invalid addresses before submission (TRC-20, ERC-20/BEP-20, Celo, Solana, Stellar).
- **Memo support** — Stellar transactions require a memo; the form surfaces this automatically when the Stellar network is selected.
- **30-minute payment countdown** — a visible timer starts once the user proceeds to the bank transfer step, ensuring escrow slots don't stay open indefinitely.
- **Order reference system** — every order gets a unique `RMP-XXX` reference for tracking and support.

### Authentication
- **Email + OTP login** — passwordless authentication via a 6-digit one-time code sent to the user's email.
- **Session persistence** — logged-in state is maintained across page navigations within the session.
- **No sign-up required for small orders** — users below the KYC threshold can transact without creating an account.

### KYC (Identity Verification)
- Triggered automatically for orders above the $50 equivalent threshold.
- Supports **BVN** (Bank Verification Number) and **NIN** (National Identification Number) for Nigerian users.
- Requires date of birth alongside the ID number.
- KYC status flows through three states: `unverified` → `pending` → `verified`.
- User data is encrypted and handled securely.

### User Dashboard
- Overview of total spend, completed orders, and pending orders.
- A **line chart** visualising fiat spend over the last 10 days.
- Quick-access stats: total volume, order count, success rate.
- Recent orders table with status badges (completed / pending / failed).

### Order History
- Full paginated list of all past orders.
- Filter by status (all / completed / pending / failed).
- Each order shows: reference ID, date, fiat amount, crypto amount, token, network, wallet address, and transaction hash.

### Saved Wallets
- Users can save frequently used wallet addresses with a custom label.
- Saved wallets are available as quick-select options in the buy form.
- Supports all networks including Stellar (with optional memo).
- Wallets can be added and removed from the Settings page.

### Profile Page
- Displays account email, KYC status, and order statistics.
- Shows a breakdown of tokens purchased and networks used.

### Settings
- Manage saved wallets (add / remove).
- Toggle email notifications for order updates.
- Account deletion (with confirmation).

### UI/UX
- **Dark / Light mode** — persisted to `localStorage`, toggled from the header on any page.
- **Responsive design** — fully mobile-optimised with a slide-in drawer navigation on small screens.
- **Accessible** — ARIA labels, roles, and keyboard navigation throughout.
- **Animated** — subtle fade-in and slide-up transitions for modals and page elements.

---

## Pages & Screens

| Route | Description |
|-------|-------------|
| `/` | Landing page — Hero, Buy Form, How It Works, Footer |
| `/dashboard` | User dashboard with stats and spend chart |
| `/history` | Full order history with filtering |
| `/profile` | User profile and KYC status |
| `/settings` | Account settings and saved wallets |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS custom properties (design tokens) |
| UI Components | React 19 — all custom, no component library |
| Icons | Custom inline SVGs + country/crypto PNG/SVG assets |
| State Management | React Context (`AuthContext`) |
| Auth | Email + OTP via Fastify backend + Resend |
| Blockchain (EVM) | [viem](https://viem.sh/) — Celo, Base, BNB Chain |
| Blockchain (Stellar) | [@stellar/stellar-sdk](https://stellar.github.io/js-stellar-sdk/) — Soroban smart contracts |
| Smart Contracts | RampitEscrow v2 (EVM proxy) + Soroban escrow (Stellar) |
| AI Agent | Celo Wallet Validation Agent — live on-chain via `forno.celo.org` |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Davidomoo/Rampit.git
cd Rampit

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout (fonts, AuthProvider)
│   ├── globals.css           # Design tokens, base styles
│   ├── dashboard/page.tsx    # User dashboard
│   ├── history/page.tsx      # Order history
│   ├── profile/page.tsx      # User profile
│   ├── settings/page.tsx     # Account settings
│   ├── privacy/page.tsx      # Privacy policy
│   └── terms/page.tsx        # Terms of service
├── components/
│   ├── Header.tsx            # Navigation bar + mobile drawer
│   ├── Hero.tsx              # Landing hero section
│   ├── HowItWorks.tsx        # 3-step explainer + stats bar
│   ├── BuyForm.tsx           # Core buy flow (form + bank modal + confirm modal)
│   ├── Footer.tsx            # Site footer
│   ├── AuthModal.tsx         # Email + OTP authentication modal
│   ├── AuthModalRoot.tsx     # Portal wrapper for AuthModal
│   └── KycModal.tsx          # KYC identity verification modal
└── lib/
    └── AuthContext.tsx       # Global auth state, order data, saved wallets
public/
└── icons/
    ├── country/              # Flag icons (NGN, GHS, KES)
    └── crypto/               # Token icons (USDT, USDC, CELO, SOL, XLM)
```

---

## Celo AI Wallet Agent

Rampit includes a live AI agent powered by the **Celo blockchain** that validates wallet addresses in real time as the user types.

### How it works
- Triggers automatically on the wallet address input field for all supported networks
- Makes **read-only RPC calls** to `https://forno.celo.org` (Celo's official public mainnet RPC)
- Uses `eth_getTransactionCount` and `eth_getCode` — **zero gas, no transactions, no wallet required**
- Detects: active wallets, empty accounts, smart contracts, and invalid address formats
- For non-EVM networks (TRC-20, Solana, Stellar) — performs strict regex format validation

### What it detects
| Result | Meaning |
|--------|---------|
| ✅ Active wallet | Address has on-chain activity on Celo |
| ⚠️ Empty account | Valid format but no Celo activity — user warned to double-check |
| ⚠️ Smart contract | Address is a contract — user warned to verify it accepts tokens |
| ✅ Format valid | Non-EVM address passes regex check (format-only, no on-chain lookup) |
| ❌ Invalid format | Address doesn't match network pattern |

### Key files
| File | Role |
|------|------|
| `src/app/api/agent/validate-wallet/route.ts` | Server-side agent — queries Celo RPC via viem |
| `src/components/WalletAgent.tsx` | Client UI — debounced, real-time feedback below wallet input |
| `src/lib/evm/client.ts` | Shared viem client used by agent + escrow |

---

## Environment & Configuration

| Feature | Status |
|---------|--------|
| OTP auth | Live via Fastify backend + Resend SMTP |
| Exchange rates | Hardcoded — replace with live rates API |
| Escrow (EVM) | Live — RampitEscrow v2 on Celo, Base, BNB |
| Escrow (Stellar) | Live — Soroban contract on Stellar mainnet |
| Payment confirmation | Needs webhook from bank/payment processor |
| KYC verification | Simulated — integrate identity provider |

---

## KYC & Compliance

Rampit implements a tiered compliance model:

- **Below $50 equivalent** — no KYC required. Users can transact immediately.
- **Above $50 equivalent** — KYC is triggered before the order can proceed.

KYC collects:
- ID type: BVN or NIN (11-digit numeric)
- Date of birth

KYC status is scoped to the user's session and displayed on their profile page. All submitted identity data is encrypted in transit and at rest.

---

## Security

- **Wallet address validation** is enforced client-side using network-specific regex patterns before any order is submitted.
- **Escrow model** — user funds go to a named escrow account, not directly to a counterparty, reducing fraud risk.
- **OTP authentication** — no passwords are stored; access is granted only via time-limited one-time codes.
- **30-minute payment window** — escrow slots expire automatically to prevent stale orders.
- **Input sanitisation** — all fiat amount inputs strip non-numeric characters before processing.

---

## License

This project is proprietary. All rights reserved © Rampit.
