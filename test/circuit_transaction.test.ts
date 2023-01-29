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
    const { commitment: inCommitment, blinding: inBlinding } = payToAddress(a.getAddress(), amount);
    const { commitment: outCommitment, blinding: outBlinding } = payToAddress(b.getAddress(), amount);
    const inNullifier = a.getNullifier(inCommitment, BigInt(0));

    tree.addLeaves([inCommitment]);
    const merkleProof = tree.merkleProof(0);

    const input = {
      inCommitment: [inCommitment],
      inAmount: [amount],
      inBlinding: [inBlinding],
      inPathIndices: [merkleProof.pathIndices],
      inPathElements: [merkleProof.siblings],
      inPrivateKey: [a.privateKey],

      outAmount: [amount],
      outPubkey: [b.publicKey],
      outBlinding: [outBlinding],

      inRoot: merkleProof.root,
      outCommitment: [outCommitment],
      inNullifier: [inNullifier],
      withdrawAmount: 0,
    };

    const wc = await buildWC(transactionCircuit);
    await wc.calculateWitness(input, 1);
  });
});
