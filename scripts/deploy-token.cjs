const fs = require("node:fs");
const path = require("node:path");
const { Wallet } = require("ethers");
const { ethers, upgrades } = require("hardhat");

const ROOT = path.resolve(__dirname, "..");
const DEPLOYMENT_FILE = path.join(ROOT, "deployments", "besu-private-tain.json");
const ADDRESSES_FILE = path.join(ROOT, "docs", "addresses.json");
const ZERO_GAS_TX = { type: 0, gasPrice: 0 };

function readPrivateKey(name) {
  const file = path.join(ROOT, "secrets", name);
  const key = fs.readFileSync(file, "utf8").trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`invalid private key file: ${file}`);
  }
  return `0x${key}`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 2026052501n) {
    throw new Error(`unexpected chainId: ${network.chainId.toString()}`);
  }

  const treasury = new Wallet(readPrivateKey("treasury.key")).address;
  const operator = new Wallet(readPrivateKey("operator.key")).address;
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== treasury.toLowerCase()) {
    throw new Error(`deployer ${deployer.address} does not match treasury ${treasury}`);
  }

  const BPTToken = await ethers.getContractFactory("BPTToken");
  const token = await upgrades.deployProxy(BPTToken, [treasury, operator], {
    kind: "uups",
    initializer: "initialize",
    txOverrides: ZERO_GAS_TX,
    timeout: 180000,
    pollingInterval: 2000
  });
  await token.waitForDeployment();

  const proxy = await token.getAddress();
  const implementation = await upgrades.erc1967.getImplementationAddress(proxy);
  const blockNumber = await ethers.provider.getBlockNumber();
  const deployment = {
    network: "besu-private-tain",
    chainId: Number(network.chainId),
    token: {
      name: "Besu Private Tain",
      symbol: "BPT",
      decimals: 18,
      proxy,
      implementation
    },
    roles: {
      admin: treasury,
      upgrader: treasury,
      minter: operator,
      burner: operator
    },
    deployedAtBlock: blockNumber
  };

  writeJson(DEPLOYMENT_FILE, deployment);
  writeJson(ADDRESSES_FILE, {
    network: "besu-private-tain",
    chainId: Number(network.chainId),
    symbol: "BPT",
    treasury,
    operator,
    tokenProxy: proxy,
    tokenImplementation: implementation
  });

  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
