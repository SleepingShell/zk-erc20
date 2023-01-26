//import {wasm} from "circom_tester";
const snarkjs = require("snarkjs");

import { ethers } from "hardhat";
import { expect } from "chai";
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
});
