module.exports = {
  // (optional) solidity version for compiled contracts, defaults to `^0.8.0`
  solidity: "^0.8.0",
  circom: {
    // (optional) Base path for files being read, defaults to `/circuits`
    inputBasePath: "/circuits",
    // (optional) Base path for files being output, defaults to `/build`
    outputBasePath: "/build",
    // (required) The final ptau file, relative to inputBasePath, from a Phase 1 ceremony
    ptau: "powersOfTau28_hez_final_18.ptau",
    // (required) Each object in this array refers to a separate circuit
    circuits: [
      /*
      {
        // (required) The name of the circuit
        name: "MerkleTree",
        // (required) Protocol used to build circuits ("groth16" or "plonk"), defaults to "groth16"
        protocol: "plonk",
        // (required) Input path for circuit file, inferred from `name` if unspecified
        circuit: "MerkleTree.circom",
        // (required) Output path for zkey file, inferred from `name` if unspecified
        zkey: "MerkleTree.zkey",
        // (optional) Input path for input signal data, inferred from `name` if unspecified
        input: "input.json",
        // // (optional) Output path for witness file, inferred from `name` if unspecified
        witness: "MerkleTree/MerkleTree.json",
      },
      */
      {
        name: "VerifyProof1",
        protocol: "plonk",
        circuit: "test/VerifyProof1.circom",
        zkey: "VerifyProof1.zkey",
        witness: "VerifyProof1/VerifyProof1.json",
      },
      {
        name: "VerifyProof8",
        protocol: "plonk",
        circuit: "test/VerifyProof8.circom",
        zkey: "VerifyProof8.zkey",
        witness: "VerifyProof8/VerifyProof8.json",
      },
      {
        name: "Deposit",
        protocol: "plonk",
        circuit: "Deposit.circom",
        zkey: "Deposit.zkey",
        witness: "Deposit/Deposit.json",
      },
      {
        name: "Transaction1x1",
        protocol: "plonk",
        circuit: "Transaction1x1.circom",
        zkey: "Transaction1x1.zkey",
        witness: "Transaction1x1/Transaction1x1.json",
      },
      {
        name: "Transaction1x2",
        protocol: "plonk",
        circuit: "Transaction1x2.circom",
        zkey: "Transaction1x2.zkey",
        witness: "Transaction1x2/Transaction1x2.json",
      },
      {
        name: "Transaction2x2",
        protocol: "plonk",
        circuit: "Transaction2x2.circom",
        zkey: "Transaction2x2.zkey",
        witness: "Transaction2x2/Transaction2x2.json",
      },
    ],
  },
};
