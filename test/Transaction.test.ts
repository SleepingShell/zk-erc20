const snarkjs = require("snarkjs");

import { ethers } from "hardhat";
import { expect } from "chai";
import { DepositVerifier, ZkERC20 } from "../types";
import { buildAccount, decodeAddress } from "../util/account";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { depositProof } from "../util/proof";

import { poseidonContract as poseidonContract } from "circomlibjs";

describe("Transaction proving and verification", async () => {
  const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
  const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

  let user1, user2: SignerWithAddress;
  let verifier: DepositVerifier;
  let zkerc20: ZkERC20;

  beforeEach(async () => {
    [user1, user2] = await ethers.getSigners();
    verifier = (await (await ethers.getContractFactory("DepositVerifier")).deploy()) as DepositVerifier;

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
    const incrementalTreeLib = await incrementalTreeLibFactory.deploy();

    const zkerc20Factory = await ethers.getContractFactory("zkERC20", {
      libraries: {
        IncrementalBinaryTree: incrementalTreeLib.address,
      },
    });
    zkerc20 = (await zkerc20Factory.deploy(10, 0, verifier.address)) as ZkERC20;
  });

  it("Verifier contract", async () => {
    const account1 = await buildAccount();
    const account2 = await buildAccount();
    const address1 = account1.getEncodedAddress();
    const address2 = account2.getEncodedAddress();
    const amount1 = BigInt(100);
    const amount2 = BigInt(200);

    const commit1args = account1.payToAddress(address1, amount1);
    const commit2args = account1.payToAddress(address2, amount2);

    const input = {
      outAmounts: [amount1, amount2],
      outPubkeys: [account1.publicKey, account2.publicKey],
      outBlindings: [commit1args.blinding, commit2args.blinding],
      outCommitments: [commit1args.commitment, commit2args.commitment],
      depositAmount: amount1 + amount2,
    };

    const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);

    const calldata: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
    await expect(verifier.verifyProof(calldata.split(",")[0], publicSignals));
  });

  it("Deposit contract", async () => {
    const account1 = await buildAccount();
    const account2 = await buildAccount();
    const address1 = account1.getEncodedAddress();
    const address2 = account2.getEncodedAddress();
    const amount1 = BigInt(100);
    const amount2 = BigInt(200);

    const commit1args = account1.payToAddress(address1, amount1);
    const commit2args = account1.payToAddress(address2, amount2);

    const args = await depositProof(amount1 + amount2, [
      {
        amount: amount1,
        pubkey: account1.publicKey,
        blinding: commit1args.blinding,
        commitment: commit1args.commitment,
        encryptedOutput: commit1args.encrypted,
      },
      {
        amount: amount2,
        pubkey: account2.publicKey,
        blinding: commit2args.blinding,
        commitment: commit2args.commitment,
        encryptedOutput: commit2args.encrypted,
      },
    ]);

    await zkerc20.deposit(args);
  });
});
