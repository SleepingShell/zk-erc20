import { readFileSync } from "fs";

import { buildMerkleTree } from "../util/merkleTree";

import { randomBytes32 } from "../util/utils";

const buildWC = require("../build/VerifyProof1/VerifyProof1_js/witness_calculator.js");

describe("Merkle Proof(js+circom)", async () => {
  it("1 levels", async () => {
    const m = await buildMerkleTree(1);
    m.addLeaves(["10", "20"]);
    const root = m.getRoot();
    const input = m.merkleProof(0);

    const circuitCode = readFileSync("build/VerifyProof1/VerifyProof1_js/VerifyProof1.wasm");
    await buildWC(circuitCode).then(async (wc) => {
      await wc.calculateWitness(input, 1);
    });
  });

  it("8 levels", async () => {
    const numLeaves = 40;
    const m = await buildMerkleTree(8);
    const leaves: string[] = new Array();

    for (let i = 0; i < numLeaves; i++) {
      leaves.push(randomBytes32().toString());
    }
    m.addLeaves(leaves);
    const input = m.merkleProof(22);

    const circuitCode = readFileSync("build/VerifyProof8/VerifyProof8_js/VerifyProof8.wasm");
    await buildWC(circuitCode).then(async (wc) => {
      await wc.calculateWitness(input, 1);
    });
  });
});
