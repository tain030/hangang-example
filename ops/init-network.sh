#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node ops/wallet.mjs init-keys
node ops/render-qbft-config.mjs

if [[ -f config/genesis.json || -f data/besu/key ]]; then
  echo "config/genesis.json or data/besu/key already exists; refusing to overwrite."
  echo "Move existing data aside intentionally before reinitializing."
  exit 1
fi

if [[ ! -f config/networkFiles/genesis.json ]]; then
  docker run --rm \
    -v "$ROOT/config:/config" \
    hyperledger/besu:26.5.0 \
    operator generate-blockchain-config \
    --config-file=/config/qbftConfigFile.json \
    --to=/config/networkFiles \
    --private-key-file-name=key
fi

cp config/networkFiles/genesis.json config/genesis.json
KEY_DIR="$(find config/networkFiles/keys -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)"
cp "$KEY_DIR/key" data/besu/key
cp "$KEY_DIR/key.pub" data/besu/key.pub
chmod 600 data/besu/key secrets/*.key

echo "Initialized Besu private network files."
echo "Validator address: $(basename "$KEY_DIR")"
