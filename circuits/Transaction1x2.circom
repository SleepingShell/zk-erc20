pragma circom 2.1.0;

include "./Transaction.circom";

component main {public [inRoot, outCommitment, inNullifier]}= Transaction(20,1,2);