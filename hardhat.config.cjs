require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@openzeppelin/hardhat-upgrades");

const fs = require("node:fs");
const path = require("node:path");

function readPrivateKey(name) {
  const file = path.join(__dirname, "secrets", name);
  if (!fs.existsSync(file)) return undefined;
  const key = fs.readFileSync(file, "utf8").trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`invalid private key file: ${file}`);
  }
  return `0x${key}`;
}

const treasuryKey = readPrivateKey("treasury.key");

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    besu: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: 2026052501,
      gasPrice: 0,
      accounts: treasuryKey ? [treasuryKey] : []
    }
  }
};
