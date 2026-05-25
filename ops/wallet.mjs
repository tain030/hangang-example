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
const DEPLOYMENT_FILE = resolve(ROOT, "deployments", "besu-private-tain.json");
const KEY_FILES = {
  treasury: resolve(ROOT, "secrets", "treasury.key"),
  operator: resolve(ROOT, "secrets", "operator.key")
};
const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function burnByRole(address from, uint256 amount)"
];

function usage() {
  console.log(`Usage:
  node ops/wallet.mjs init-keys
  node ops/wallet.mjs address <treasury|operator> [--plain]
  node ops/wallet.mjs health
  node ops/wallet.mjs balance <treasury|operator|0x...>
  node ops/wallet.mjs mint <to> <amount>
  node ops/wallet.mjs transfer <treasury|operator|/path/to/key> <to> <amount>
  node ops/wallet.mjs burn [operator|treasury|0x...|/path/to/key] <amount>
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
  return ethers.getAddress(value);
}

function provider() {
  return new ethers.JsonRpcProvider(RPC_URL, Number(EXPECTED_CHAIN_ID), { staticNetwork: true });
}

function signerFor(selector) {
  return new ethers.Wallet(readPrivateKey(keyFileFor(selector)), provider());
}

function deployment() {
  if (!existsSync(DEPLOYMENT_FILE)) {
    throw new Error("token_not_deployed: run ./ops/deploy-token.sh first");
  }
  return JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
}

function tokenAddress() {
  const value = deployment()?.token?.proxy;
  if (!value) throw new Error("token_proxy_missing_in_deployment");
  return ethers.getAddress(value);
}

function token(runner = provider()) {
  return new ethers.Contract(tokenAddress(), TOKEN_ABI, runner);
}

function formatAmount(wei) {
  return `${ethers.formatEther(wei)} ${TOKEN_SYMBOL}`;
}

function parseAmount(value) {
  if (!value) throw new Error("missing_amount");
  return ethers.parseEther(value);
}

function txOverrides() {
  return { type: 0, gasPrice: 0n };
}

function deploymentTokenInfo() {
  if (!existsSync(DEPLOYMENT_FILE)) return {};
  const value = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
  return {
    tokenProxy: value?.token?.proxy,
    tokenImplementation: value?.token?.implementation
  };
}

async function waitAndPrint(tx, details) {
  const receipt = await tx.wait();
  console.log(JSON.stringify({
    hash: tx.hash,
    blockNumber: receipt?.blockNumber ?? null,
    status: receipt?.status ?? null,
    ...details
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
    ...deploymentTokenInfo()
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
    validators,
    tokenDeployed: existsSync(DEPLOYMENT_FILE)
  }, null, 2));
}

async function cmdBalance(target) {
  const addr = resolveAddress(target);
  const wei = await token().balanceOf(addr);
  console.log(JSON.stringify({ token: tokenAddress(), address: addr, wei: wei.toString(), formatted: formatAmount(wei) }, null, 2));
}

async function cmdSupply() {
  const erc20 = token();
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    erc20.name(),
    erc20.symbol(),
    erc20.decimals(),
    erc20.totalSupply()
  ]);
  console.log(JSON.stringify({
    token: tokenAddress(),
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply: formatAmount(totalSupply)
  }, null, 2));
}

async function cmdMint(to, amount) {
  const signer = signerFor("operator");
  const recipient = resolveAddress(to);
  const tx = await token(signer).mint(recipient, parseAmount(amount), txOverrides());
  await waitAndPrint(tx, {
    action: "mint",
    token: tokenAddress(),
    operator: signer.address,
    to: recipient,
    amount: `${amount} ${TOKEN_SYMBOL}`
  });
}

async function cmdTransfer(selector, to, amount) {
  const signer = signerFor(selector);
  const recipient = resolveAddress(to);
  const tx = await token(signer).transfer(recipient, parseAmount(amount), txOverrides());
  await waitAndPrint(tx, {
    action: "transfer",
    token: tokenAddress(),
    from: signer.address,
    to: recipient,
    amount: `${amount} ${TOKEN_SYMBOL}`
  });
}

async function cmdBurn(selector, amount) {
  if (!selector || !amount) throw new Error("usage: burn [operator|treasury|0x...|/path/to/key] <amount>");

  if (KEY_FILES[selector] || existsSync(keyFileFor(selector))) {
    const signer = signerFor(selector);
    const tx = await token(signer).burn(parseAmount(amount), txOverrides());
    await waitAndPrint(tx, {
      action: "burn",
      mode: "self",
      token: tokenAddress(),
      from: signer.address,
      amount: `${amount} ${TOKEN_SYMBOL}`
    });
    return;
  }

  const operator = signerFor("operator");
  const from = resolveAddress(selector);
  const tx = await token(operator).burnByRole(from, parseAmount(amount), txOverrides());
  await waitAndPrint(tx, {
    action: "burn",
    mode: "burnByRole",
    token: tokenAddress(),
    operator: operator.address,
    from,
    amount: `${amount} ${TOKEN_SYMBOL}`
  });
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
        return await cmdMint(args[0], args[1]);
      case "transfer":
        if (args.length !== 3) throw new Error("usage: transfer <treasury|operator|/path/to/key> <to> <amount>");
        return await cmdTransfer(args[0], args[1], args[2]);
      case "burn": {
        const selector = args.length === 1 ? "operator" : args[0];
        const amount = args.length === 1 ? args[0] : args[1];
        return await cmdBurn(selector, amount);
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
