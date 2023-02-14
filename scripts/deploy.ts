import { ethers } from "hardhat";
import { poseidonContract as poseidonContract } from "circomlibjs";

import { ZkERC20, DepositVerifier } from "../types";
import { Contract } from "ethers";

async function deployAndAddAndPrintVerifier(zkerc20: ZkERC20, numInputs: number, numOutputs: number) {
  const name = `Transaction${numInputs}x${numOutputs}Verifier`;
  const tx = (await (await ethers.getContractFactory(name)).deploy()).address;
  await zkerc20.addVerifier(numInputs, numOutputs, tx);
  console.log(`${name}: ${tx}`);
}

async function deployAndAddTransactionVerifiers(zkerc20: ZkERC20) {
  await deployAndAddAndPrintVerifier(zkerc20, 1, 1);
  await deployAndAddAndPrintVerifier(zkerc20, 1, 2);
  await deployAndAddAndPrintVerifier(zkerc20, 2, 2);
}

async function deployIncrementalMerkleTreeLib(): Promise<Contract> {
  const poseidonT3LibFactory = new ethers.ContractFactory(
    poseidonContract.generateABI(2),
    poseidonContract.createCode(2),
    (await ethers.getSigners())[0]
  );
  const poseidonT3Lib = await poseidonT3LibFactory.deploy();

  const incrementalTreeLibFactory = await ethers.getContractFactory("IncrementalBinaryTree", {
    libraries: {
      PoseidonT3: poseidonT3Lib.address,
    },
  });
  return await incrementalTreeLibFactory.deploy();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const depositVerifier = (await (await ethers.getContractFactory("DepositVerifier")).deploy()).address;
  console.log(`DepositVerifier: ${depositVerifier}`);

  const incrementalTreeLib = await deployIncrementalMerkleTreeLib();
  const zkerc20Factory = await ethers.getContractFactory("zkERC20", {
    libraries: {
      IncrementalBinaryTree: incrementalTreeLib.address,
    },
  });

  const zkerc20 = (await zkerc20Factory.deploy(20, 0, depositVerifier)) as ZkERC20;
  await deployAndAddTransactionVerifiers(zkerc20);

  console.log(`zkERC20: ${zkerc20.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
