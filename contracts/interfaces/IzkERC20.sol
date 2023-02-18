pragma solidity ^0.8;

import "../zkERC20.sol";

interface IzkERC20 {
  function addVerifier(uint256 numInputs, uint256 numOutputs, IVerifier verifier) external;
  function addToken(IERC20 token) external;
  function deposit(zkERC20.DepositArgs calldata args) external;
  function transact(zkERC20.TransactionArgs calldata args) external;
}