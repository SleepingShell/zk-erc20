# zk-ERC20
This is an implementation of shielded UTXO transfers I created to teach myself Circom.

The following protocols were studied for inspiration:
- Tornado Cash
- Zcash
- Railgun

The [SHIELD framework](https://github.com/xorddotcom/SHIELD) sets up an easy environment for circuit compilation and testing.

# Deposit
A user deposits by creating a transaction with 0-value commitments.