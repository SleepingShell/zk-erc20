pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template Deposit(nOuts, nTokens) {
  // private signals
  signal input outAmounts[nOuts][nTokens];
  signal input outPubkeys[nOuts];
  signal input outBlindings[nOuts];

  // public signals
  signal input outCommitments[nOuts];
  signal input depositAmount[nTokens];

  var totals[nTokens];
  component hashers[nOuts];
  for (var i = 0; i < nOuts; i++) {
    hashers[i] = Poseidon(nTokens+2);
    for (var t = 0; t < nTokens; t++) {
      hashers[i].inputs[t] <== outAmounts[i][t];
      totals[t] += outAmounts[i][t];
    }
    hashers[i].inputs[nTokens] <== outPubkeys[i];
    hashers[i].inputs[nTokens+1] <== outBlindings[i];

    outCommitments[i] === hashers[i].out;
  }

  for (var t = 0; t < nTokens; t++) {
    totals[t] === depositAmount[t];
  }
}

component main {public [outCommitments, depositAmount]} = Deposit(2, 10);