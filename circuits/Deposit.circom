pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template Deposit(nOuts) {
  // private signals
  signal input outAmounts[nOuts];
  signal input outPubkeys[nOuts];
  signal input outBlindings[nOuts];

  // public signals
  signal input outCommitments[nOuts];
  signal input depositAmount;

  var total = 0;
  component hashers[nOuts];
  for (var i = 0; i < nOuts; i++) {
    hashers[i] = Poseidon(3);
    hashers[i].inputs[0] <== outAmounts[i];
    hashers[i].inputs[1] <== outPubkeys[i];
    hashers[i].inputs[2] <== outBlindings[i];

    outCommitments[i] === hashers[i].out;
    total += outAmounts[i];
  }

  depositAmount === total;
}

component main {public [outCommitments, depositAmount]} = Deposit(2);