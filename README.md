# Besu Private Tain

Single-node Hyperledger Besu private network for local/internal testing.

## Network

- Network name: `besu-private-tain`
- Chain ID: `2026052501` (`0x78c31b95`)
- Native symbol: `BPT`
- Consensus: single-validator QBFT
- Gas: free gas (`min-gas-price=0`, `zeroBaseFee=true`)
- HTTP RPC: `http://127.0.0.1:8545`
- WebSocket RPC: `ws://127.0.0.1:8546`
- Metrics: `http://127.0.0.1:9545/metrics`

## Commands

```bash
npm install
./ops/init-network.sh
docker compose up -d
./ops/health.sh
./ops/supply.sh
```

Mint native `BPT` by transferring from treasury:

```bash
./ops/mint.sh 0xRecipientAddress 100
```

Burn native `BPT` by sending holder funds to the burn address:

```bash
./ops/burn.sh treasury 10
./ops/burn.sh operator 10
```

## Security Notes

- `secrets/*.key` and `data/` are ignored and must not be published.
- RPC is bound to localhost only. For team use, expose it through Tailscale/VPN allowlists, not `0.0.0.0`.
- Single-node QBFT has no Byzantine fault tolerance. Add validators before treating this as shared infrastructure.

