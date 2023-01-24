# zk-ERC20
This is an implementation of shielded UTXO transfers utilizing zk proofs.

The following protocols were studied for inspiration:
- Tornado Cash
- Zcash
- Railgun

The [SHIELD framework](https://github.com/xorddotcom/SHIELD) sets up an easy environment for circuit compilation and testing.

## Overview
The above mentioned projects all share a similar framework in how they achieve private transfers of currency. The core principle of these systems is the private link between **commitments** and **nullifiers**. These two structures have a 1-to-1 relationship, each commitment only has 1 valid nullifier and vice versa. However, revealing a nullifier crucially does **not** reveal which commitment it is linked to.

A commitment *commits* the UTXO to a specified amount and public key.
A nullifier *nullifies* the commitment it is linked to so that it cannot be double-spent.

Commitments are stored in a cryptographic accumulator in which we can prove membership (merkle tree). The root of this merkle tree is stored on-chain.
Nullifiers are stored in a hashmap on-chain to prevent double-spends. Theoretically, a cryptographic accumulator that provides nonmembership proofs (such as a sparse merkle tree) would also work. There is a tradeoff between zk prover time and gas cost of storage.

## Transactions
If we want to spend an input UTXO (commitment) and generate a new output UTXO, we must prove the following:
1. The input commitment exists in the set of all commitments.
2. The input nullifier does **not** exist in the set of all nullifiers.
3. The new UTXO's value is <= the input UTXO.
4. The new UTXO's commitment has been properly generated.

We can prove 1,3,4 in a zero-knowledge proof. This will allow us to hide which input commitment is being spent, and who the new output commitment is destined for.
2 is proven on-chain simply by checking if the nullifier exists in the hashmap.

### Deposit
A user deposits by creating a transaction with 0-value commitments.