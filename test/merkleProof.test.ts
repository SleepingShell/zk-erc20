const snarkjs = require("snarkjs");
const { readFileSync, writeFile } = require("fs");

describe("Merkle Proof", async () => {
  it("Create Merkle Proof", async () => {
    const input = JSON.parse(readFileSync("test/merkleTree_0.input.json"));
    const {proof, publicSignals} = await snarkjs.plonk.fullProve(
      input,
      "build/MakeProof/MakeProof_js/MakeProof.wasm",
      "build/MakeProof/MakeProof.zkey",
    );

    //console.log(JSON.stringify(proof,null,1));
    console.log(publicSignals)

    const vKey = JSON.parse(readFileSync("build/MakeProof/verification_key.json"));

    const verifyValid = await snarkjs.plonk.verify(vKey, publicSignals, proof);
    console.log(verifyValid);
  });
});

/*
const wc  = require("../build/ProverTest/ProverTest_js/witness_calculator.js");
const { readFileSync, writeFile } = require("fs");

describe("Merkle Tree building and proving", async () => {

  it('Build Merkle Tree', async () => {
    
  });

  it('Verify Merkle Proof (1)', async () => {
    const input = JSON.parse(readFileSync("test/merkleTree_1.input.json"));
    
    const buffer = readFileSync("build/ProverTest/ProverTest_js/ProverTest.wasm");
    wc(buffer).then(async witnessCalculator => {
	    const buff= await witnessCalculator.calculateWTNSBin(input,0);
      //console.log(JSON.stringify(buff));
      //writeFile(process.argv[4], buff, function(err) {
      //  if (err) throw err;
      //});
    
    });
  });
});
*/