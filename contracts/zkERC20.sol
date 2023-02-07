pragma solidity ^0.8.0;

import "@zk-kit/incremental-merkle-tree.sol/IncrementalBinaryTree.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVerifier {
  function verifyProof(bytes memory proof, uint[] memory pubSignals)
    external
    view
    returns (bool);
  }

contract zkERC20 is Ownable {
  using IncrementalBinaryTree for IncrementalTreeData;
  using SafeERC20 for IERC20;

  uint256 constant MAX_TOKENS = 10;

  // TODO: If we don't care to allow senders to index their deposits, then we only need thr transaction event
  event Deposit(address indexed sender, uint256 commitment, uint256 index, bytes encryptedData);
  event Commitment(uint256 commitment, uint256 index, bytes encryptedData);

  error MaxTokensAdded();
  error DoubleSpend(uint256);

  IncrementalTreeData public tree;
  IVerifier depositVerifier;
  
  mapping(uint256 => bool) nullifiers;
  /// @dev Because the commitment tree is append-only, we only need to confirm that a user's tx uses ANY
  ///       valid root. Not necessairly the latest one
  mapping(uint256 => bool) public isValidCommitmentRoot;
  mapping(uint256 => IVerifier) public verifiers;

  IERC20[] public tokens;

  struct DepositArgs {
    uint256[MAX_TOKENS] depositAmount;
    uint256[2] outCommitments;
    bytes[2] encryptedOutputs;
    bytes proof;
  }

  struct TransactionArgs {
    uint256 root;
    uint256[MAX_TOKENS] withdrawAmount;
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

  function addVerifier(uint256 numInputs, uint256 numOutputs, IVerifier verifier) external onlyOwner {
    verifiers[getEncodedVerifierLookup(numInputs, numOutputs)] = verifier;
  }

  /// @notice This function does NOT check if this token has already been added!
  function addToken(IERC20 token) external onlyOwner {
    if (tokens.length == MAX_TOKENS) {
      revert MaxTokensAdded();
    }
    tokens.push(token);
  }

  function deposit(DepositArgs calldata args) external {
    // Verify proof
    uint256[] memory publicSignals = new uint256[](2+MAX_TOKENS);
    publicSignals[0] = args.outCommitments[0];
    publicSignals[1] = args.outCommitments[1];
    for (uint i = 0; i < MAX_TOKENS; i++) {
      publicSignals[2+i] = args.depositAmount[i];
    }
    require(depositVerifier.verifyProof(args.proof, publicSignals));

    // Insert new commitments into tree
    // Checking if commits exist would be for safety, but if not then sender can lose money
    tree.insert(args.outCommitments[0]);
    tree.insert(args.outCommitments[1]);
    isValidCommitmentRoot[tree.root] = true;
    uint256 x = tree.numberOfLeaves;
    emit Deposit(msg.sender, args.outCommitments[0], x-2, args.encryptedOutputs[0]);
    emit Deposit(msg.sender, args.outCommitments[1], x-1, args.encryptedOutputs[1]);

    // Take tokens from sender
    for (uint i = 0; i < MAX_TOKENS; i++) {
      uint amt = args.depositAmount[i];
      if (amt != 0) {
        tokens[i].safeTransferFrom(msg.sender, address(this), amt);
      }
    }
  }

  function transact(TransactionArgs calldata args) external {
    require(isValidCommitmentRoot[args.root], 'Invalid root');
    uint256 numInputs = args.inNullifiers.length;
    uint256 numOutputs = args.outCommitments.length;

    IVerifier verifier = verifiers[getEncodedVerifierLookup(numInputs, numOutputs)];
    require(address(verifier) != address(0), 'Unsupported tx format');

    uint i;
    uint256[] memory publicSignals = new uint256[](2 + numInputs + numOutputs + MAX_TOKENS);
    publicSignals[0] = args.root;
    while (i < MAX_TOKENS) {
      publicSignals[i+1] = args.withdrawAmount[i];
      unchecked {
        i++;
      }
    }

    uint nullifier;
    i = 0;
    while (i < numInputs) {
      nullifier = args.inNullifiers[i];
      if (nullifiers[nullifier]) {
        revert DoubleSpend(nullifier);
      }
      nullifiers[nullifier] = true;
      publicSignals[i+1+MAX_TOKENS] = nullifier;
      unchecked {
        i++;
      }
    }

    i = 0;
    while (i < numOutputs) {
      nullifier = args.outCommitments[i]; //reuse nullifier memory locatin
      publicSignals[i+1+MAX_TOKENS+numInputs] = nullifier;
      tree.insert(nullifier);
      emit Commitment(nullifier, tree.numberOfLeaves, args.encryptedOutputs[i]);
      unchecked {
        i++;
      }
    }
    require(verifier.verifyProof(args.proof, publicSignals));

    i = 0;
    while (i < MAX_TOKENS) {
      uint amt = args.withdrawAmount[i];
      if (amt != 0) {
        tokens[i].safeTransfer(msg.sender, amt);
      }

      unchecked {
        i++;
      }
    }
  }


  function getEncodedVerifierLookup(uint256 numInputs, uint256 numOutputs) internal pure returns (uint256) {
    return (numInputs << 32 | numOutputs);
  }
}