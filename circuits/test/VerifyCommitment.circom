pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template CreateCommitment() {
  signal input amount;
  signal input publicKey;
  signal input blinding;
  signal output commitment;

  component hasher = Poseidon(3);
  hasher.inputs[0] <== amount;
  hasher.inputs[1] <== publicKey;
  hasher.inputs[2] <== blinding;

  commitment <== hasher.out;
}

template VerifyCommitment() {
  signal input amount;
  signal input publicKey;
  signal input blinding;
  signal input commitment;

  component t = CreateCommitment();
  t.amount <== amount;
  t.publicKey <== publicKey;
  t.blinding <== blinding;

  commitment === t.commitment;
}

component main {public [commitment]} = VerifyCommitment();