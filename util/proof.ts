const snarkjs = require("snarkjs");

import { BigNumber } from "ethers";
import { ZkERC20 } from "../types/contracts/ZkERC20";
type DepositArgsStruct = ZkERC20.DepositArgsStruct;

const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

export async function depositProof(
  depositAmount: BigInt,
  commitmentInputs: {
    amount: BigInt;
    pubkey: BigInt;
    blinding: BigInt;
    commitment: BigInt;
    encryptedOutput: string;
  }[]
): Promise<DepositArgsStruct> {
  const input = {
    outAmounts: [commitmentInputs[0].amount, commitmentInputs[1].amount],
    outPubkeys: [commitmentInputs[0].pubkey, commitmentInputs[1].pubkey],
    outBlindings: [commitmentInputs[0].blinding, commitmentInputs[1].blinding],
    outCommitments: [commitmentInputs[0].commitment, commitmentInputs[1].commitment],
    depositAmount: depositAmount,
  };

  const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);
  const calldata: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  const proofCalldata = calldata.split(",")[0];

  const args: DepositArgsStruct = {
    depositAmount: BigNumber.from(depositAmount),
    outCommitments: [BigNumber.from(commitmentInputs[0].commitment), BigNumber.from(commitmentInputs[1].commitment)],
    encryptedOutputs: ["0x" + commitmentInputs[0].encryptedOutput, "0x" + commitmentInputs[1].encryptedOutput],
    proof: proofCalldata,
  };

  return args;
}
