pragma solidity ^0.8.0;

import "@zk-kit/incremental-merkle-tree.sol/IncrementalBinaryTree.sol";

interface IVerifier {
  function verifyProof(bytes memory proof, uint[] memory pubSignals)
    external
    view
    returns (bool);
  }

contract zkERC20 {
  using IncrementalBinaryTree for IncrementalTreeData;

  uint256 constant MAX_TOKENS = 10;

  // TODO: If we don't care to allow senders to index their deposits, then we only need thr transaction event
  event Deposit(address indexed sender, uint256 commitment, uint256 index, bytes encryptedData);
  event Commitment(uint256 commitment, uint256 index, bytes encryptedData);

  IncrementalTreeData public tree;
  IVerifier depositVerifier;
  
  mapping(uint256 => bool) nullifiers;

  /// @dev Because the commitment tree is append-only, we only need to confirm that a user's tx uses ANY
  ///       valid root. Not necessairly the latest one
  mapping(uint256 => bool) public isValidCommitmentRoot;

  mapping(uint256 => IVerifier) public verifiers;

  struct DepositArgs {
    uint256[MAX_TOKENS] depositAmount;
    uint256[2] outCommitments;
    bytes[2] encryptedOutputs;
    bytes proof;
  }

  struct TransactionArgs {
    uint256 root;
    uint256 withdrawAmount;
    uint256[] inNullifiers;
    uint256[] outCommitments;
    bytes[] encryptedOutputs;
    bytes proof;
  }

  constructor(
    uint256 _depth,
    uint256 _zero,
    IVerifier _depositVerifier
  ) {
    tree.init(_depth, _zero);
    depositVerifier = _depositVerifier;
  }

  // TODO: Protect function
  function addVerifier(uint256 numInputs, uint256 numOutputs, IVerifier verifier) external {
    verifiers[getEncodedVerifierLookup(numInputs, numOutputs)] = verifier;
  }

  function deposit(DepositArgs calldata args) external {
    //TODO: Verify payed amount and args.depositAmount match
    //TODO: Reentrancy
    uint256[] memory publicSignals = new uint256[](2+MAX_TOKENS);
    publicSignals[0] = args.outCommitments[0];
    publicSignals[1] = args.outCommitments[1];
    for (uint i = 0; i < MAX_TOKENS; i++) {
      publicSignals[2+i] = args.depositAmount[i];
    }

    require(depositVerifier.verifyProof(args.proof, publicSignals));

    // Checking if commits exist would be for safety, but if not then sender can lose money
    tree.insert(args.outCommitments[0]);
    tree.insert(args.outCommitments[1]);

    isValidCommitmentRoot[tree.root] = true;

    uint256 x = tree.numberOfLeaves;

    emit Deposit(msg.sender, args.outCommitments[0], x-2, args.encryptedOutputs[0]);
    emit Deposit(msg.sender, args.outCommitments[1], x-1, args.encryptedOutputs[1]);
  }

  function transact(TransactionArgs calldata args) external {
    require(isValidCommitmentRoot[args.root], 'Invalid root');
    uint256 numInputs = args.inNullifiers.length;
    uint256 numOutputs = args.outCommitments.length;

    IVerifier verifier = verifiers[getEncodedVerifierLookup(numInputs, numOutputs)];
    require(address(verifier) != address(0), 'Unsupported tx format');

    uint256[] memory publicSignals = new uint256[](2 + numInputs + numOutputs);
    publicSignals[0] = args.root;
    publicSignals[1] = args.withdrawAmount;

    uint nullifier;
    uint i;
    while (i < numInputs) {
      nullifier = args.inNullifiers[i];
      require(!nullifiers[nullifier], 'Double spend');
      nullifiers[nullifier] = true;
      publicSignals[i+2] = nullifier;
      unchecked {
        i++;
      }
    }

    i = 0;
    while (i < numOutputs) {
      nullifier = args.outCommitments[i]; //reuse nullifier memory locatin
      publicSignals[i+2+numInputs] = nullifier;
      tree.insert(nullifier);
      emit Commitment(nullifier, tree.numberOfLeaves, args.encryptedOutputs[i]);
      unchecked {
        i++;
      }
    }

    require(verifier.verifyProof(args.proof, publicSignals));

    if (args.withdrawAmount > 0) {
      // TODO: Transfer withdrawn amount.
      // In order to preserve privacy while transacting but not withdrawing with various tokens, there will
      // need to be a public input of the address of the token being withdrawn. The circuit will need to
      // confirm that the spent utxo is of the same token type. However, when there is no public withdraw,
      // we still need to verify token addresses match while keeping the input private
    }
  }


  function getEncodedVerifierLookup(uint256 numInputs, uint256 numOutputs) internal pure returns (uint256) {
    return (numInputs << 32 | numOutputs);
  }
}