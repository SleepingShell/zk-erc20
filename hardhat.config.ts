import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-tracer";
import dotenv from "dotenv";
dotenv.config();

const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  typechain: {
    outDir: "./types",
  },
  mocha: {
    timeout: 100000, //Required for long zk proving times
  },
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org/",
      chainId: 11155111,
      accounts: {
        mnemonic: MNEMONIC,
        path: MNEMONIC_PATH,
        initialIndex: 1,
      },
    },
  },
};

export default config;
