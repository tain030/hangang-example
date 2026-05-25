#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const EXPECTED_CHAIN_ID = 2026052501n;
const TOKEN_SYMBOL = "BPT";
const INITIAL_SUPPLY_WEI = 1000000000n * 10n ** 18n;
const BURN_ADDRESS = process.env.BURN_ADDRESS || "0x000000000000000000000000000000000000dEaD";
const KEY_FILES = {
  treasury: resolve(ROOT, "secrets", "treasury.key"),
  operator: resolve(ROOT, "secrets", "operator.key")
};

function usage() {
  console.log(`Usage:
  node ops/wallet.mjs init-keys
  node ops/wallet.mjs address <treasury|operator> [--plain]
  node ops/wallet.mjs health
  node ops/wallet.mjs balance <treasury|operator|burn|0x...>
  node ops/wallet.mjs mint <to> <amount>
  node ops/wallet.mjs transfer <treasury|operator|/path/to/key> <to> <amount>
  node ops/wallet.mjs burn [treasury|operator|/path/to/key] <amount>
  node ops/wallet.mjs supply

Amounts are denominated in ${TOKEN_SYMBOL} with 18 decimals.`);
}

function normalizePrivateKey(raw) {
  const key = String(raw || "").trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("invalid_private_key_file");
  }
  return `0x${key}`;
}

function readPrivateKey(file) {
  return normalizePrivateKey(readFileSync(file, "utf8"));
}

function ensureKeyFile(file) {
  if (existsSync(file)) return false;
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return true;
}

function keyFileFor(selector) {
  if (KEY_FILES[selector]) return KEY_FILES[selector];
  return resolve(ROOT, selector);
}

function addressForKeyFile(file) {
  return new ethers.Wallet(readPrivateKey(file)).address;
}

function resolveAddress(value) {
  if (value === "treasury" || value === "operator") return addressForKeyFile(KEY_FILES[value]);
  if (value === "burn") return BURN_ADDRESS;
  return ethers.getAddress(value);
}

function provider() {
  return new ethers.JsonRpcProvider(RPC_URL, Number(EXPECTED_CHAIN_ID), { staticNetwork: true });
}

function formatAmount(wei) {
  return `${ethers.formatEther(wei)} ${TOKEN_SYMBOL}`;
}

function parseAmount(value) {
  if (!value) throw new Error("missing_amount");
  return ethers.parseEther(value);
}

async function sendValue(keyFile, to, amount) {
  const wallet = new ethers.Wallet(readPrivateKey(keyFile), provider());
  const tx = await wallet.sendTransaction({
    to: ethers.getAddress(to),
    value: parseAmount(amount),
    type: 0,
    gasPrice: 0n,
    gasLimit: 21000n
  });
  const receipt = await tx.wait();
  console.log(JSON.stringify({
    hash: tx.hash,
    from: wallet.address,
    to: ethers.getAddress(to),
    amount: `${amount} ${TOKEN_SYMBOL}`,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null
  }, null, 2));
}

async function cmdInitKeys() {
  const generated = Object.fromEntries(
    Object.entries(KEY_FILES).map(([name, file]) => [name, ensureKeyFile(file)])
  );
  const addresses = {
    network: "besu-private-tain",
    chainId: Number(EXPECTED_CHAIN_ID),
    symbol: TOKEN_SYMBOL,
    treasury: addressForKeyFile(KEY_FILES.treasury),
    operator: addressForKeyFile(KEY_FILES.operator),
    burn: BURN_ADDRESS
  };
  writeFileSync(resolve(ROOT, "docs", "addresses.json"), `${JSON.stringify(addresses, null, 2)}\n`);
  console.log(JSON.stringify({ generated, addresses }, null, 2));
}

async function cmdHealth() {
  const rpc = provider();
  const network = await rpc.getNetwork();
  const blockNumber = await rpc.getBlockNumber();
  const gasPrice = await rpc.send("eth_gasPrice", []);
  const validators = await rpc.send("qbft_getValidatorsByBlockNumber", ["latest"]);
  console.log(JSON.stringify({
    rpcUrl: RPC_URL,
    chainId: network.chainId.toString(),
    expectedChainId: EXPECTED_CHAIN_ID.toString(),
    chainIdOk: network.chainId === EXPECTED_CHAIN_ID,
    blockNumber,
    gasPrice,
    freeGasOk: gasPrice === "0x0",
    validators
  }, null, 2));
}

async function cmdBalance(target) {
  const addr = resolveAddress(target);
  const wei = await provider().getBalance(addr);
  console.log(JSON.stringify({ address: addr, wei: wei.toString(), formatted: formatAmount(wei) }, null, 2));
}

async function cmdSupply() {
  const rpc = provider();
  const treasury = addressForKeyFile(KEY_FILES.treasury);
  const [treasuryBalance, burnBalance] = await Promise.all([
    rpc.getBalance(treasury),
    rpc.getBalance(BURN_ADDRESS)
  ]);
  const circulating = INITIAL_SUPPLY_WEI - treasuryBalance - burnBalance;
  console.log(JSON.stringify({
    initialSupply: formatAmount(INITIAL_SUPPLY_WEI),
    treasury,
    treasuryBalance: formatAmount(treasuryBalance),
    burn: BURN_ADDRESS,
    burnBalance: formatAmount(burnBalance),
    circulating: formatAmount(circulating)
  }, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    switch (cmd) {
      case "init-keys":
        return await cmdInitKeys();
      case "address": {
        const selector = args[0];
        if (!KEY_FILES[selector]) throw new Error("unknown_key_selector");
        const address = addressForKeyFile(KEY_FILES[selector]);
        console.log(args.includes("--plain") ? address : JSON.stringify({ selector, address }, null, 2));
        return;
      }
      case "health":
        return await cmdHealth();
      case "balance":
        return await cmdBalance(args[0]);
      case "mint":
        if (args.length !== 2) throw new Error("usage: mint <to> <amount>");
        return await sendValue(KEY_FILES.treasury, resolveAddress(args[0]), args[1]);
      case "transfer":
        if (args.length !== 3) throw new Error("usage: transfer <treasury|operator|/path/to/key> <to> <amount>");
        return await sendValue(keyFileFor(args[0]), resolveAddress(args[1]), args[2]);
      case "burn": {
        const selector = args.length === 1 ? "treasury" : args[0];
        const amount = args.length === 1 ? args[0] : args[1];
        return await sendValue(keyFileFor(selector), BURN_ADDRESS, amount);
      }
      case "supply":
        return await cmdSupply();
      default:
        usage();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

await main();

