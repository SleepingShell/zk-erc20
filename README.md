# zk-ERC20

This is an implementation of shielded UTXO transfers utilizing zk proofs.

The following protocols were studied for inspiration:

- Tornado Cash
- Zcash
- Railgun

The [SHIELD framework](https://github.com/xorddotcom/SHIELD) sets up an easy environment for circuit compilation and testing.

## Overview

The above mentioned projects all share a similar framework in how they achieve private transfers of currency. The core principle of these systems is the private link between **commitments** and **nullifiers**. These two structures have a 1-to-1 relationship, each commitment only has 1 valid nullifier and vice versa. However, revealing a nullifier crucially does **not** reveal which commitment it is linked to.

A commitment _commits_ the UTXO to a specified amount and public key.
A nullifier _nullifies_ the commitment it is linked to so that it cannot be double-spent.

Commitments are stored in a cryptographic accumulator in which we can prove membership (merkle tree). The root of this merkle tree is stored on-chain.
Nullifiers are stored in a hashmap on-chain to prevent double-spends. Theoretically, a cryptographic accumulator that provides nonmembership proofs (such as a sparse merkle tree) would also work. There is a tradeoff between zk prover time and gas cost of storage.

## Accounts

An account is composed of the following data:
| Data | Type | Purpose |
|------|------|---------|
| Private Key | Random 32-byte scalar | Spend UTXOs |
| Public Key | Hash(Private Key) | Receive UTXOs |
| Encryption Key | See [eth-sig-utils](https://github.com/MetaMask/eth-sig-util/blob/31c4539/src/encryption.ts#L239), derived from Private Key | Decrypt UTXO data |

## Transactions

If we want to spend an input UTXO (commitment) and generate a new output UTXO, we must prove the following:

1. The input commitment exists in the set of all commitments.
2. The input nullifier does **not** exist in the set of all nullifiers.
3. The new UTXO's value is <= the input UTXO.
4. The new UTXO's commitment has been properly generated.

We can prove 1,3,4 in a zero-knowledge proof. This will allow us to hide which input commitment is being spent, and who the new output commitment is destined for.
2 is proven on-chain simply by checking if the nullifier exists in the set of nullifiers.

Ideally, there would be a set accumulator that allows us to prove nonmembership of the set for accumulators. This would allow us to prove the entire transaction in zero knowledge. At first, sparse merkle trees seems like an ideal solution for this. However, the problem of synchronity arises.

Commitments must be proven to exist within the merkle tree of all commitments. Since this tree is append-only, the prover needs to only use a root that has _ever_ been valid. However, for the nullifiers, we would always need to check against the most recent root, or else a malicious actor could double spend by verifying against a valid but old root that didn't include the nullifier. Therefore, if we were to prove nonmembership with a sparse merkle tree, senders would have to re-calculate their zk proof everytime a new transaction is confirmed before theirs.

### Transaction data requirements

In order for the system to properly function, there must be a data availability layer (DA) to communicate the various parts of the system. The required data, and their location, are as follows:

| Data                             | Location                   |
| -------------------------------- | -------------------------- |
| Commitment merkle root           | Contract Storage (Hashmap) |
| Nullifier set                    | Contract Storage (Hashmap) |
| Encrypted Commitment information | Event log                  |

In order for a user to generate the nullifier for a received commitment, it must know the amount received and blinding. This information is communicated to the receiver by encrypting to their public key and transmitting the encrypted data along with the commitment event log.

### Deposit

A user deposits by creating a transaction with 0-value commitments.

## TODO

- [ ] Unify all tests + typescript files to use a single typed witness calculator variable, since they are all the same (or maybe make upstream shield change)
- [x] Clean up account and exported functions should only deal with addresses, not keys directly
- [x] Convert BigNumbers to either string or BigInt (?)
- [x] Move functions out of account class
  - Shouldn't require having to build Poseidon multiple times
- [x] Add address field to commitments to support multiple tokens
- [ ] Research Poseidon > 16 inputs. Or must do multiple Poseidons and then output hash into the commitment
- [ ] Typescript util should accept a map of token addresses to values, and then order the array in utxo accordingly

## Future Work

- As a thought experiment that can possibly be extended to an L2 architecture, treat the blockchain as a centralized synchronous sequencer. If we assume that the verifier will always have access to the latest merkle tree and nullifier set, then we can:
  - Prove in zk updating the commitment tree, therefore only posting the root publicly
  - Prove in zk updating the nullifier set, therefore we can utilize a sparse merkle tree for proving nonmembership
  - Note the limitation in the earlier section still applies. Users would have to generate proofs with the latest data
- Aggregation of proof using something like [Maze](https://github.com/privacy-scaling-explorations/maze)

#### Random notes

- If you get "\*.zkey: Missing section 1" on running `shield compile` then the ptau ceremony is probably too small for the circuit
- It seems that calling the witness calculator directly will accept BigNumbers, but calling plonk.fullProve requires first converting the input into BigInt
