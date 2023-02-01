import { readFileSync } from "fs";
import { expect } from "chai";

import { Account, payToAddress, Utxo } from "../util/account";
import { randomBytes32 } from "../util/utils";
import { buildMerkleTree } from "../util/merkleProof";

const buildWC = require("../build/Transaction1x1/Transaction1x1_js/witness_calculator.js");
//import { builder as buildWC } from "../build/Transaction/Transaction_js/witness_calculator.js";

describe("Circuit: Transaction", async () => {
  const transactionCircuit = readFileSync("build/Transaction1x1/Transaction1x1_js/Transaction1x1.wasm");

  it("Transaction verification", async () => {
    const tree = await buildMerkleTree(20);
    const a = new Account();
    const b = new Account();
    const amount = BigInt(100);
    const inUtxo = payToAddress(a.getAddress(), amount);
    const outUtxo = payToAddress(b.getAddress(), amount);
    inUtxo.setIndex(0n);
    outUtxo.setIndex(1n);
    inUtxo.setNullifier(a.privateKey);

    tree.addLeaves([inUtxo.commitment]);
    const merkleProof = tree.merkleProof(0);

    const input = {
      inCommitment: [inUtxo.commitment],
      inAmount: [amount],
      inBlinding: [inUtxo.blinding],
      inPathIndices: [merkleProof.pathIndices],
      inPathElements: [merkleProof.siblings],
      inPrivateKey: [a.privateKey],

      outAmount: [amount],
      outPubkey: [b.publicKey],
      outBlinding: [outUtxo.blinding],

      inRoot: merkleProof.root,
      outCommitment: [outUtxo.commitment],
      inNullifier: [inUtxo.nullifier],
      withdrawAmount: 0,
    };

    const wc = await buildWC(transactionCircuit);
    await wc.calculateWitness(input, 1);
  });
});
