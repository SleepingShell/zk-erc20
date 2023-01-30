pragma circom 2.1.0;

include "./MerkleProof.circom";

/*
commitment = hash(amount, pubKey, blinding)
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

template Transaction(levels, nIns, nOuts) {
  // private signals
  signal input inCommitment[nIns];
  signal input inAmount[nIns];
  signal input inBlinding[nIns];
  signal input inPathIndices[nIns];
  signal input inPathElements[nIns][levels];
  signal input inPrivateKey[nIns];

  signal input outAmount[nOuts];
  signal input outPubkey[nOuts];
  signal input outBlinding[nOuts];

  // public signals
  signal input inRoot;
  signal input withdrawAmount;
  signal input inNullifier[nIns];
  signal input outCommitment[nOuts];

  component inKeyPair[nIns];
  component inCommitmentHasher[nIns];
  component outCommitmentHasher[nOuts];
  component inNullifierHasher[nIns];
  component inTree[nIns];
  component checkRoot[nIns];
  component dupNullifiers[nIns * (nIns - 1) / 2];

  var inTotal;
  var outTotal;
  var dupIndex = 0;

  // Check input commitments + nullifiers are valid
  for (var i = 0; i < nIns; i++) {
    inKeyPair[i] = KeyPair();
    inKeyPair[i].privateKey <== inPrivateKey[i];

    inCommitmentHasher[i] = Poseidon(3);
    inCommitmentHasher[i].inputs[0] <== inAmount[i];
    inCommitmentHasher[i].inputs[1] <== inKeyPair[i].publicKey;
    inCommitmentHasher[i].inputs[2] <== inBlinding[i];
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
    checkRoot[i].enabled <== inAmount[i];

    inTotal += inAmount[i];

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
    outCommitmentHasher[i] = Poseidon(3);
    outCommitmentHasher[i].inputs[0] <== outAmount[i];
    outCommitmentHasher[i].inputs[1] <== outPubkey[i];
    outCommitmentHasher[i].inputs[2] <== outBlinding[i];

    outCommitment[i] === outCommitmentHasher[i].out;
    outTotal += outAmount[i];
  }

  inTotal + withdrawAmount === outTotal;
}