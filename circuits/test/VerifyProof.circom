pragma circom 2.1.0;

include "../MerkleProof.circom";

// This proves we know the merkle proof for this leaf
template VerifyProof(n) {
  signal input root;
  signal input leaf;
  signal input pathElements[n];
  signal input pathIndices;

  component proof = MerkleProof(n);
  proof.leaf <== leaf;
  proof.pathIndices <== pathIndices;
  for (var i = 0; i < n; i++) {
    proof.pathElements[i] <== pathElements[i];
  }

  log("proo", proof.root);
  log("root", root);
  root === proof.root;
}

component main {public [root]} = VerifyProof(1);