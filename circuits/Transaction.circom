pragma circom 2.1.0;

include "./MerkleTree.circom";

/*
commitment = hash(amount, pubKey, blinding)
nullifier = hash(commitment, merklePath, privKey)
*/

// With the beauty of zk proofs, we just need to prove knowledge of the public key preimage!
template KeyPair() {
  signal input privateKey;
  signal output publicKey;

  component hasher = Poseidon(1);
  hasher.inputs[0] <== privateKey;
  publicKey <== hasher.out;
}
/*
TODO for expanding to multiple ins/outs:
- Ensure non-duplicate input nullifiers
- Ensure non-duplicate output commitments
*/

// 1 to 1 transaction
template Transaction(levels, nIns, nOuts) {
  // private signals
  signal input inCommitment;
  signal input inAmount;
  signal input inBlinding;
  signal input inPathIndices;
  signal input inPathElements[levels];
  signal input inPrivateKey;

  signal input outAmount;
  signal input outPubkey;
  signal input outBlinding;

  // public signals
  signal input inRoot;
  signal input outCommitment;
  signal input inNullifier;
  signal input externalAmount;

  // output signals

  component inKeypair = KeyPair();
  inKeypair.privateKey <== inPrivateKey;
  var inPublicKey = inKeypair.publicKey;

  component inCommitmentHasher = Poseidon(3);
  inCommitmentHasher.inputs[0] <== inAmount;
  inCommitmentHasher.inputs[1] <== inPublicKey;
  inCommitmentHasher.inputs[2] <== inBlinding;
  inCommitment === inCommitmentHasher.out;

  component inNullifierHasher = Poseidon(3);
  inNullifierHasher.inputs[0] <== inCommitmentHasher.out;
  inNullifierHasher.inputs[1] <== inPathIndices;
  inNullifierHasher.inputs[2] <== inPrivateKey;
  inNullifier === inNullifierHasher.out;

  component inTree = MerkleProof(levels);
  inTree.leaf <== inCommitment;
  inTree.pathIndices <== inPathIndices;
  for (var i = 0; i < levels; i++) {
    inTree.pathElements[i] <== inPathElements[i];
  }

  component checkRoot = ForceEqualIfEnabled();
  checkRoot.in[0] <== inRoot;
  checkRoot.in[1] <== inTree.root;
  checkRoot.enabled <== inAmount; // Checks on any non-zero
  
  component outCommitmentHasher = Poseidon(3);
  outCommitmentHasher.inputs[0] <== outAmount;
  outCommitmentHasher.inputs[1] <== outPubkey;
  outCommitmentHasher.inputs[2] <== outBlinding;

  outCommitment === outCommitmentHasher.out;
  
  inAmount + externalAmount === outAmount;
}

component main {public [inRoot, outCommitment, inNullifier]}= Transaction(20,1,1);