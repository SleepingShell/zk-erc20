import { plonk } from "snarkjs";

import { BigNumber } from "ethers";
import { ZkERC20 } from "../types/contracts/ZkERC20";
import { MerkleProof, MerkleTree } from "./merkleProof";
type DepositArgsStruct = ZkERC20.DepositArgsStruct;
type TransactionArgsStruct = ZkERC20.TransactionArgsStruct;

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

  const { proof, publicSignals } = await plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);
  const calldata: string = await plonk.exportSolidityCallData(proof, publicSignals);
  const proofCalldata = calldata.split(",")[0];

  const args: DepositArgsStruct = {
    depositAmount: BigNumber.from(depositAmount),
    outCommitments: [BigNumber.from(commitmentInputs[0].commitment), BigNumber.from(commitmentInputs[1].commitment)],
    encryptedOutputs: ["0x" + commitmentInputs[0].encryptedOutput, "0x" + commitmentInputs[1].encryptedOutput],
    proof: proofCalldata,
  };

  return args;
}

// TODO: Utilize UTXO structs to pass inputs/outputs
export async function transactionProof(
  tree: MerkleTree,
  withdrawAmount: BigInt,
  inputs: {
    commitment: BigInt;
    amount: BigInt;
    bliding: BigInt;
    index: BigInt;
    nullifier: BigInt;
    privateKey: BigInt;
  }[],
  outputs: {
    amount: BigInt;
    pubkey: BigInt;
    bliding: BigInt;
    commitment: BigInt;
    encrypted: string;
  }[]
): Promise<TransactionArgsStruct> {
  const proofInput: TransactionProofInputs = {
    inRoot: tree.getRoot(),
    withdrawAmount: withdrawAmount,
  } as TransactionProofInputs;

  let mProof: MerkleProof;
  for (const input of inputs) {
    mProof = tree.merkleProof(Number(input.index));

    proofInput.inCommitment.push(input.commitment);
    proofInput.inAmount.push(input.amount);
    proofInput.inBlinding.push(input.bliding);
    proofInput.inPathIndices.push(mProof.pathIndices);
    proofInput.inPathElements.push(mProof.siblings);
    proofInput.inNullifier.push(input.nullifier);
    proofInput.inPrivateKey.push(input.privateKey);
  }

  const encryptedOutputs: string[] = [];
  for (const output of outputs) {
    proofInput.outAmount.push(output.amount);
    proofInput.outPubkey.push(output.pubkey);
    proofInput.outBlinding.push(output.bliding);
    proofInput.outCommitment.push(output.commitment);
    encryptedOutputs.push("0x" + output.encrypted);
  }

  const path = getCircuitPath(inputs.length, outputs.length);
  const { proof, publicSignals } = await plonk.fullProve(proofInput, path.circuit, path.key);
  const calldata: string = await plonk.exportSolidityCallData(proof, publicSignals);
  const proofCalldata = calldata.split(",");

  const args: TransactionArgsStruct = {
    root: BigNumber.from(proofInput.inRoot),
    withdrawAmount: BigNumber.from(proofInput.withdrawAmount),
    inNullifiers: proofInput.inNullifier,
    outCommitments: proofInput.outCommitment, //TODO: Figure out how to avoid casting to BigNumber
    encryptedOutputs: encryptedOutputs,
    proof: proofCalldata,
  };

  return args;
}

type TransactionProofInputs = {
  inRoot: BigInt;
  withdrawAmount: BigInt;
  inNullifier: BigInt[];
  outCommitment: BigInt[];

  inCommitment: BigInt[];
  inAmount: BigInt[];
  inBlinding: BigInt[];
  inPathIndices: BigInt[];
  inPathElements: BigInt[][];
  inPrivateKey: BigInt[];

  outAmount: BigInt[];
  outPubkey: BigInt[];
  outBlinding: BigInt[];
};

function getCircuitPath(numInputs: number, numOutputs: number): { circuit: string; key: string } {
  if (numInputs > 2 || numOutputs > 2) {
    throw "Invalid number of inputs or outputs";
  }

  const s = `Transaction${numInputs}x${numOutputs}`;
  return {
    circuit: `build/${s}/${s}_js/${s}.wasm`,
    key: `build/${s}/${s}.zkey`,
  };
}
