import { BigNumber } from "ethers";
import { readFileSync } from "fs";
import { expect } from "chai";

import { buildAccount } from "../util/account"
import { randomBytes32 } from "../util/utils";

const buildWC = require("../build/Deposit/Deposit_js/witness_calculator.js")

describe("Deposits", async () => {
  const depositCircuit = readFileSync("build/Deposit/Deposit_js/Deposit.wasm");

  it("Deposit commitments are correct", async () => {
    const a = await buildAccount();

    const amount1 = BigNumber.from(500);
    const pubkey1 = a.publicKey;
    const blinding1 = randomBytes32();
    const commit1 = a.generateCommitment(amount1, pubkey1, blinding1);

    const amount2 = BigNumber.from(0);
    const pubkey2 = BigNumber.from(0);
    const blinding2 = randomBytes32();
    const commit2 = a.generateCommitment(amount2, pubkey2, blinding2);

    const input = {
      outAmounts: [amount1, amount2],
      outPubkeys: [pubkey1, pubkey2],
      outBlindings: [blinding1, blinding2],
      outCommitments: [commit1, commit2],
      depositAmount: amount1.add(amount2)
    }

    const wc = await buildWC(depositCircuit);
    await wc.calculateWitness(input, 1);

    await expect(wc.calculateWitness(Object.assign({}, input, {outAmounts: [amount2, amount1]}),1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, {outPubkeys: [pubkey2, pubkey1]}),1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, {outBlindings: [blinding1, 0]}),1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, {outCommitments: [commit2, commit1]}),1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, {depositAmount: 0}),1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, {depositAmount: 1000}),1)).rejectedWith(Error);
  });
})