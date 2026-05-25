# Besu Private Tain Network

## Purpose

This network is a one-server, one-validator Hyperledger Besu private network for internal testing. Gas is free, and the business asset is an upgradeable RBAC ERC-20 contract named `BPT`.

## Chain Parameters

| Field | Value |
| --- | --- |
| Network name | `besu-private-tain` |
| Chain ID | `2026052501` (`0x78c31b95`) |
| Consensus | QBFT, one validator |
| Validator | `0x17948b3ea9b2dccd9af88b8e8fdbc25d28166f3a` |
| Block period | `2s` |
| Request timeout | `4s` |
| Native allocation | empty |
| Gas policy | `min-gas-price=0`, `zeroBaseFee=true` |

## ERC-20 BPT Model

`BPT` is not the Besu native coin. The native coin is not used for gas or asset accounting. The ERC-20 contract is deployed through an OpenZeppelin UUPS proxy.

| Field | Value |
| --- | --- |
| Name | `Besu Private Tain` |
| Symbol | `BPT` |
| Decimals | `18` |
| Proxy | `0x78ACb3b334036b644387CA28B9b944F7888af67C` |
| Implementation | `0xB193E9d08277aF3ADD8FE66d3Fb734E0221cb9A1` |
| Initial supply | `0 BPT` |

## Roles

| Role | Account |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | Treasury `0x870428BB916477fEbFff5A3D6aaCbF6805Fd4c27` |
| `UPGRADER_ROLE` | Treasury `0x870428BB916477fEbFff5A3D6aaCbF6805Fd4c27` |
| `MINTER_ROLE` | Operator `0xa06eCe6201ccbC0FF8cbDaE337175316944B9179` |
| `BURNER_ROLE` | Operator `0xa06eCe6201ccbC0FF8cbDaE337175316944B9179` |

## Mint And Burn

- Mint: operator calls `BPTToken.mint(to, amount)`.
- Self burn: holder calls `BPTToken.burn(amount)`.
- Role burn: operator calls `BPTToken.burnByRole(from, amount)`.
- Supply: `BPTToken.totalSupply()`.

The old native treasury allocation model has been removed. If the chain is reinitialized again, keep `genesis.alloc` empty and redeploy the ERC-20 proxy.

## Exposure Policy

RPC and WS are exposed only on the server's Tailscale IP:

- HTTP RPC: `http://100.108.197.109:8545`
- WebSocket RPC: `ws://100.108.197.109:8546`

Metrics remains local-only:

- `127.0.0.1:9545`

Do not bind RPC to public `0.0.0.0`. External clients should join the same Tailscale tailnet and use Tailscale ACLs if access needs to be restricted further.
