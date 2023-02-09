import { readFileSync } from "fs";
import { expect } from "chai";

import { Account } from "../util/account";
import { randomBytes32 } from "../util/utils";
import { buildMerkleTree } from "../util/merkleProof";
import { UtxoInput, zeroAmounts } from "../util/utxo";

const buildWC = require("../build/Transaction1x1/Transaction1x1_js/witness_calculator.js");
//import { builder as buildWC } from "../build/Transaction/Transaction_js/witness_calculator.js";

describe("Circuit: Transaction", async () => {
  const transactionCircuit = readFileSync("build/Transaction1x1/Transaction1x1_js/Transaction1x1.wasm");

  it("Transaction verification", async () => {
    const tree = await buildMerkleTree(20);
    const a = new Account();
    const b = new Account();
    const amounts = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const t = a.payRaw(amounts);
    t.finalize();
    const inUtxo = UtxoInput.fromOutput(t, 0n, a.privateKey);
    const outUtxo = b.payRaw(amounts);

    tree.addLeaves([inUtxo.commitment]);
    const merkleProof = tree.merkleProof(0);

    const input = {
      inCommitment: [inUtxo.commitment],
      inAmount: [amounts],
      inBlinding: [inUtxo.blinding],
      inPathIndices: [merkleProof.pathIndices],
      inPathElements: [merkleProof.siblings],
      inPrivateKey: [a.privateKey],

      outAmount: [amounts],
      outPubkey: [b.publicKey],
      outBlinding: [outUtxo.blinding],

      inRoot: merkleProof.root,
      outCommitment: [outUtxo.commitment],
      inNullifier: [inUtxo.nullifier],
      withdrawAmount: zeroAmounts(),
    };

    const wc = await buildWC(transactionCircuit);
    await wc.calculateWitness(input, 1);

    const wrongAmounts = Object.assign({}, amounts);
    wrongAmounts[0] = 200n;

    await expect(wc.calculateWitness(Object.assign({}, input, { outAmount: [wrongAmounts] }), 1)).rejectedWith(Error);

    await expect(
      wc.calculateWitness(Object.assign({}, input, { withdrawAmount: [1000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] }), 1)
    ).rejectedWith(Error);
  });
});
