const snarkjs = require("snarkjs");
const { readFileSync } = require("fs");

import { expect } from "chai";
import { buildMerkleTree, MerkleTree } from "../util/merkleProof";

import { randomBytes } from "crypto";
import { BigNumber } from "ethers";

const buildWC = require("../build/VerifyProof1/VerifyProof1_js/witness_calculator.js");

describe.only("Merkle Proof(js+circom)", async () => {
  it("1 levels", async () => {
    const m = await buildMerkleTree(1);
    m.addLeaves(["10", "20"]);
    const root = m.getRoot()
    const input = m.merkleProof(0);

    const circuitCode = readFileSync("build/VerifyProof1/VerifyProof1_js/VerifyProof1.wasm");
    await buildWC(circuitCode).then(async wc => {
      await wc.calculateWitness(input, 1);
    })

    // This code shows how we can create a zkProof, but we only need to constrain the witness
    /*
    const {proof, publicSignals} = await snarkjs.plonk.fullProve(
      input,
      "build/VerifyProof1/VerifyProof1_js/VerifyProof1.wasm",
      "build/VerifyProof1/VerifyProof1.zkey",
    );
    const vKey = JSON.parse(readFileSync("build/MakeProof/verification_key.json"));
    const verifyValid = await snarkjs.plonk.verify(vKey, publicSignals, proof);
    console.log(verifyValid);
    */
  });

  it("8 levels", async () => {
    const randomElement = () => BigNumber.from(randomBytes(32));

    const numLeaves = 40;
    const m = await buildMerkleTree(8);
    const leaves: string[] = new Array();

    for (let i = 0; i < numLeaves; i++) {
      leaves.push(randomElement().toString());
    }
    m.addLeaves(leaves);
    const input = m.merkleProof(22);

    const circuitCode = readFileSync("build/VerifyProof8/VerifyProof8_js/VerifyProof8.wasm");
    await buildWC(circuitCode).then(async wc => {
      await wc.calculateWitness(input, 1);
    })
  });
});