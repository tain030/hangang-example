# Besu Private Tain Network

## Purpose

This network is a one-server, one-validator Hyperledger Besu private network for internal testing. It starts with a native token-like accounting model using Besu's native coin, a treasury allocation, and a burn address.

## Chain Parameters

| Field | Value |
| --- | --- |
| Network name | `besu-private-tain` |
| Chain ID | `2026052501` (`0x78c31b95`) |
| Native symbol | `BPT` |
| Decimals | `18` |
| Consensus | QBFT, one validator |
| Block period | `2s` |
| Request timeout | `4s` |
| Initial treasury allocation | `1,000,000,000 BPT` |
| Burn address | `0x000000000000000000000000000000000000dEaD` |

## Native Mint And Burn Model

The native protocol balance is not modified by a custom Besu fork.

- Mint: transfer `BPT` from the genesis-funded treasury account to a recipient.
- Burn: the holder transfers `BPT` to `0x000000000000000000000000000000000000dEaD`.
- Circulating supply: `initialSupply - treasuryBalance - burnAddressBalance`.

This mirrors only the operational idea of issuance and retirement. It does not provide protocol-level arbitrary balance mutation. If forced burn, issuer-specific balances, or bank-style token contracts are required, add a UUPS/RBAC ERC-20 contract layer.

## Project Hangang Design Reference

Project Hangang used Hyperledger Besu with QBFT in a permissioned ledger. Its issuance/burn behavior was contract-layer design: ERC-20-style digital currency/deposit token contracts, UUPS upgradeability, RBAC, and an atomic burn-and-issue flow for interbank deposit token transfers. That design is not the same as modifying Besu native balances.

## Exposure Policy

Initial deployment binds RPC, WS, and metrics to localhost only:

- `127.0.0.1:8545`
- `127.0.0.1:8546`
- `127.0.0.1:9545`

For team access, bind to the server's Tailscale IP and restrict access through Tailscale ACLs or a reverse proxy allowlist.

