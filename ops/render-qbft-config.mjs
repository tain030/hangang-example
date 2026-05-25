#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TREASURY_KEY_FILE = resolve(ROOT, "secrets", "treasury.key");
const OUT = resolve(ROOT, "config", "qbftConfigFile.json");

function privateKeyAddress(file) {
  const key = readFileSync(file, "utf8").trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new Error("invalid_treasury_key");
  return new ethers.Wallet(`0x${key}`).address;
}

const treasury = privateKeyAddress(TREASURY_KEY_FILE);
const config = {
  genesis: {
    config: {
      chainId: 2026052501,
      berlinBlock: 0,
      londonBlock: 0,
      zeroBaseFee: true,
      contractSizeLimit: 2147483647,
      qbft: {
        blockperiodseconds: 2,
        epochlength: 30000,
        requesttimeoutseconds: 4
      }
    },
    nonce: "0x0",
    timestamp: "0x58ee40ba",
    gasLimit: "0x1fffffffffffff",
    difficulty: "0x1",
    mixHash: "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    coinbase: "0x0000000000000000000000000000000000000000",
    alloc: {
      [treasury.slice(2)]: {
        comment: "Treasury allocation for native BPT. Private key is stored separately in secrets/treasury.key.",
        balance: "0x33b2e3c9fd0803ce8000000"
      }
    }
  },
  blockchain: {
    nodes: {
      generate: true,
      count: 1
    }
  }
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(config, null, 2)}\n`);
console.log(JSON.stringify({ path: OUT, treasury }, null, 2));

