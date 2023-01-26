//import {wasm} from "circom_tester";
const snarkjs = require("snarkjs");

import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { DepositVerifier } from "../types";
import { buildAccount, decodeAddress } from "../util/account";

describe("Transaction proving and verification", async () => {
  const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
  const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

  let user1, user2;

  beforeEach(async () => {
    [user1, user2] = await ethers.getSigners();
  });

  it("Deposit", async () => {
    const verifier: DepositVerifier = (await (
      await ethers.getContractFactory("DepositVerifier")
    ).deploy()) as DepositVerifier;
    console.log(verifier.address);

    const account1 = await buildAccount();
    const account2 = await buildAccount();
    const amount1 = BigNumber.from(100);
    const amount2 = BigNumber.from(200);

    const commit1args = account1.generateAndEncryptCommitment(amount1, account1.publicKey, account1.encryptionKey);
    const commit2args = account1.generateAndEncryptCommitment(amount2, account2.publicKey, account2.encryptionKey);

    const input = {
      outAmounts: [amount1.toBigInt(), amount2.toBigInt()],
      outPubkeys: [account1.publicKey.toBigInt(), account2.publicKey.toBigInt()],
      outBlindings: [commit1args.blinding.toBigInt(), commit2args.blinding.toBigInt()],
      outCommitments: [commit1args.commitment, commit2args.commitment],
      depositAmount: amount1.add(amount2).toBigInt(),
    };

    const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);

    const calldata: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
    console.log(await verifier.verifyProof(calldata.split(",")[0], publicSignals));
  });
});
