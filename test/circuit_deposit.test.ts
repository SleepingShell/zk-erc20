import { readFileSync } from "fs";
import { expect } from "chai";

import { Account } from "../util/account";
import { randomBytes32 } from "../util/utils";
import { zeroOutput } from "../util/utxo";

const buildWC = require("../build/Deposit/Deposit_js/witness_calculator.js");

describe("Circuit: Deposit", async () => {
  const depositCircuit = readFileSync("build/Deposit/Deposit_js/Deposit.wasm");

  it("Deposit commitments are correct", async () => {
    const a = new Account();

    const amount1 = [500n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const utxo1 = a.payRaw(amount1);

    const amount2 = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const utxo2 = zeroOutput();

    const input = {
      outAmounts: [amount1, amount2],
      outPubkeys: [utxo1.publicKey, utxo2.publicKey],
      outBlindings: [utxo1.blinding, utxo2.blinding],
      outCommitments: [utxo1.commitment, utxo2.commitment],
      depositAmount: amount1.map((num, i) => num + amount2[i]),
    };

    const wc = await buildWC(depositCircuit);
    await wc.calculateWitness(input, 1);

    await expect(wc.calculateWitness(Object.assign({}, input, { outAmounts: [amount2, amount1] }), 1)).rejectedWith(
      Error
    );
    await expect(
      wc.calculateWitness(Object.assign({}, input, { outPubkeys: [utxo2.publicKey, utxo1.publicKey] }), 1)
    ).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, { outBlindings: [utxo1.blinding, 0] }), 1)).rejectedWith(
      Error
    );
    await expect(
      wc.calculateWitness(Object.assign({}, input, { outCommitments: [utxo2.commitment, utxo1.commitment] }), 1)
    ).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, { depositAmount: 0 }), 1)).rejectedWith(Error);
    await expect(wc.calculateWitness(Object.assign({}, input, { depositAmount: 1000 }), 1)).rejectedWith(Error);
  });
});
