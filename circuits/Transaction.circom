pragma circom 2.1.0;

include "./MerkleProof.circom";

/*
[amounts] is an array of all amounts of the commitment. 
For example, if a commitment only has 100 of token type 1, and there are only 4 nTokens, then [0, 100, 0, 0]
commitment = hash([amounts], pubKey, blinding)
nullifier = hash(commitment, merkle tree index, privKey)
*/

// With the beauty of zk proofs, we just need to prove knowledge of the public key preimage!
template KeyPair() {
  signal input privateKey;
  signal output publicKey;

  component hasher = Poseidon(1);
  hasher.inputs[0] <== privateKey;
  publicKey <== hasher.out;
}

template Transaction(levels, nIns, nOuts, nTokens) {
  // private signals
  signal input inCommitment[nIns];
  signal input inAmount[nIns][nTokens];
  signal input inBlinding[nIns];
  signal input inPathIndices[nIns];
  signal input inPathElements[nIns][levels];
  signal input inPrivateKey[nIns];

  signal input outAmount[nOuts][nTokens];
  signal input outPubkey[nOuts];
  signal input outBlinding[nOuts];

  // public signals
  signal input inRoot;
  signal input withdrawAmount[nTokens];
  signal input inNullifier[nIns];
  signal input outCommitment[nOuts];

  component inKeyPair[nIns];
  component inCommitmentHasher[nIns];
  component outCommitmentHasher[nOuts];
  component inNullifierHasher[nIns];
  component inTree[nIns];
  component checkRoot[nIns];
  component dupNullifiers[nIns * (nIns - 1) / 2];

  var dupIndex;

  var inTotals[nTokens];
  var outTotals[nTokens];
  // Check input commitments + nullifiers are valid
  for (var i = 0; i < nIns; i++) {
    var nonzero; //If this commitment has ANY non-zero value
    inKeyPair[i] = KeyPair();
    inKeyPair[i].privateKey <== inPrivateKey[i];

    inCommitmentHasher[i] = Poseidon(nTokens+2);
    for (var t = 0; t < nTokens; t++) {
      inCommitmentHasher[i].inputs[t] <== inAmount[i][t];
      inTotals[t] += inAmount[i][t];
      nonzero += inAmount[i][t];
    }
    inCommitmentHasher[i].inputs[nTokens] <== inKeyPair[i].publicKey;
    inCommitmentHasher[i].inputs[nTokens+1] <== inBlinding[i];
    inCommitment[i] === inCommitmentHasher[i].out;

    inNullifierHasher[i] = Poseidon(3);
    inNullifierHasher[i].inputs[0] <== inCommitmentHasher[i].out;
    inNullifierHasher[i].inputs[1] <== inPathIndices[i];
    inNullifierHasher[i].inputs[2] <== inPrivateKey[i];
    inNullifier[i] === inNullifierHasher[i].out;

    inTree[i] = MerkleProof(levels);
    inTree[i].leaf <== inCommitment[i];
    inTree[i].pathIndices <== inPathIndices[i];
    for (var j = 0; j < levels; j++) {
      inTree[i].pathElements[j] <== inPathElements[i][j];
    }

    checkRoot[i] = ForceEqualIfEnabled();
    checkRoot[i].in[0] <== inRoot;
    checkRoot[i].in[1] <== inTree[i].root;
    checkRoot[i].enabled <== nonzero;

    // Verify there are no duplicate nullifiers
    // TODO: If the contract checks nullifiers aren't spent (and progressively sets them while checking), 
    //       can we remove this check?
    for (var j = i+1; j < nIns; j++) {
      dupNullifiers[dupIndex] = IsEqual();
      dupNullifiers[dupIndex].in[0] <== inNullifier[i];
      dupNullifiers[dupIndex].in[1] <== inNullifier[j];
      dupNullifiers[dupIndex].out === 0;
      dupIndex++;
    }
  }

  for (var i = 0; i < nOuts; i++) {
    outCommitmentHasher[i] = Poseidon(nTokens+2);
    for (var t = 0; t < nTokens; t++) {
      outCommitmentHasher[i].inputs[t] <== outAmount[i][t];
      outTotals[t] += outAmount[i][t];
    }
    outCommitmentHasher[i].inputs[nTokens] <== outPubkey[i];
    outCommitmentHasher[i].inputs[nTokens+1] <== outBlinding[i];

    outCommitment[i] === outCommitmentHasher[i].out;
  }

  for (var t = 0; t < nTokens; t++) {
    inTotals[t] === outTotals[t] + withdrawAmount[t];
  }
}