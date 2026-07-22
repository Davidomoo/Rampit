import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { celo } from "viem/chains";

export const runtime = "nodejs";
export const maxDuration = 15;

const celoClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org", { timeout: 10_000 }),
});

export type WalletAgentResult = {
  valid: boolean;
  status: "valid" | "invalid_format" | "empty_account" | "contract" | "active_eoa" | "format_only" | "error";
  message: string;
  details: {
    isContract?: boolean;
    txCount?: number;
    celoscanUrl?: string;
    checkedVia?: string;
  };
};

// Networks that share the 0x EVM address format — Celo RPC can check them
const EVM_NETWORKS = new Set(["Celo Network", "ERC-20", "BEP-20"]);

// Regex patterns per network
const PATTERNS: Record<string, RegExp> = {
  "TRC-20":      /^T[A-Za-z1-9]{33}$/,
  "ERC-20":      /^0x[a-fA-F0-9]{40}$/,
  "BEP-20":      /^0x[a-fA-F0-9]{40}$/,
  "Celo Network":/^0x[a-fA-F0-9]{40}$/,
  "Solana":      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  "Stellar":     /^G[A-Z2-7]{55}$/,
};

const FORMAT_HINTS: Record<string, string> = {
  "TRC-20":      "Must start with T and be 34 characters",
  "ERC-20":      "Must start with 0x and be 42 characters",
  "BEP-20":      "Must start with 0x and be 42 characters",
  "Celo Network":"Must start with 0x and be 42 characters",
  "Solana":      "Must be a valid base58 address (32–44 characters)",
  "Stellar":     "Must start with G and be 56 characters",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const address: string = body?.address?.trim() ?? "";
  const network: string = body?.network?.trim() ?? "";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (!address) {
    return NextResponse.json<WalletAgentResult>({
      valid: false, status: "invalid_format",
      message: "No address provided.", details: {},
    }, { headers });
  }

  const pattern = PATTERNS[network];

  // Format validation first (applies to all networks)
  if (pattern && !pattern.test(address)) {
    return NextResponse.json<WalletAgentResult>({
      valid: false, status: "invalid_format",
      message: `Invalid ${network} address. ${FORMAT_HINTS[network] ?? ""}`,
      details: {},
    });
  }

  // EVM networks — do full on-chain check via Celo RPC
  if (EVM_NETWORKS.has(network) && isAddress(address)) {
    try {
      const [txCount, bytecode] = await Promise.all([
        celoClient.getTransactionCount({ address }),
        celoClient.getBytecode({ address }),
      ]);

      const isContract = !!bytecode && bytecode !== "0x";
      const celoscanUrl = `https://celoscan.io/address/${address}`;
      const checkedVia = "AI Agent (EVM verification)";

      if (isContract) {
        return NextResponse.json<WalletAgentResult>({
          valid: true, status: "contract",
          message: `Valid ${network} address format. Note: this address is a smart contract — verify it can receive tokens.`,
          details: { isContract: true, txCount, celoscanUrl, checkedVia },
        });
      }

      if (txCount === 0 && !isContract) {
        return NextResponse.json<WalletAgentResult>({
          valid: true, status: "empty_account",
          message: `Valid ${network} address format. No on-chain activity detected — double-check this is your correct wallet.`,
          details: { isContract: false, txCount: 0, celoscanUrl, checkedVia },
        });
      }

      return NextResponse.json<WalletAgentResult>({
        valid: true, status: "active_eoa",
        message: `Valid ${network} address. Active wallet detected (${txCount} txn${txCount !== 1 ? "s" : ""}).`,
        details: { isContract: false, txCount, celoscanUrl, checkedVia },
      });
    } catch {
      return NextResponse.json<WalletAgentResult>({
        valid: false, status: "error",
        message: "Verification unavailable. Please double-check your address manually.",
        details: {},
      });
    }
  }

  // Non-EVM networks (TRC-20, Solana, Stellar) — format is valid, no on-chain check possible via Celo
  return NextResponse.json<WalletAgentResult>({
    valid: true, status: "format_only",
    message: `Valid ${network} address format. On-chain verification not available for ${network} — double-check before proceeding.`,
    details: { checkedVia: "Format validation only (non-EVM network)" },
  });
}
