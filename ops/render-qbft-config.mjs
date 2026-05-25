#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "config", "qbftConfigFile.json");
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
    alloc: {}
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
console.log(JSON.stringify({ path: OUT, nativeAlloc: "empty" }, null, 2));
