import { plonk } from "snarkjs";

import { ZkERC20 } from "../types/contracts/ZkERC20.sol";
import { MerkleProof, MerkleTree } from "./merkleProof";
import { UtxoInput, UtxoOutput } from "./utxo";
type DepositArgsStruct = ZkERC20.DepositArgsStruct;
type TransactionArgsStruct = ZkERC20.TransactionArgsStruct;

const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

export async function depositProof(depositAmount: bigint[], outputs: UtxoOutput[]): Promise<DepositArgsStruct> {
  const input: DepositProofInput = {
    outAmounts: [outputs[0].amounts, outputs[1].amounts],
    outPubkeys: [outputs[0].publicKey, outputs[1].publicKey],
    outBlindings: [outputs[0].blinding, outputs[1].blinding],
    outCommitments: [outputs[0].commitment, outputs[1].commitment],
    depositAmount: depositAmount,
  };

  const { proof, publicSignals } = await plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);
  const calldata: string = await plonk.exportSolidityCallData(proof, publicSignals);
  const proofCalldata = calldata.split(",")[0];

  const args: DepositArgsStruct = {
    depositAmount: depositAmount,
    outCommitments: [outputs[0].commitment, outputs[1].commitment],
    encryptedOutputs: ["0x" + outputs[0].encryptedData, "0x" + outputs[1].encryptedData],
    proof: proofCalldata,
  };

  return args;
}

type DepositProofInput = {
  outAmounts: bigint[][];
  outPubkeys: bigint[];
  outBlindings: bigint[];

  outCommitments: bigint[];
  depositAmount: bigint[];
};

export async function transactionProof(
  tree: MerkleTree,
  withdrawAmount: bigint[],
  inputs: UtxoInput[],
  outputs: UtxoOutput[]
): Promise<TransactionArgsStruct> {
  const proofInput: TransactionProofInput = {
    inRoot: tree.getRoot(),
    withdrawAmount: withdrawAmount,

    inNullifier: new Array(0),
    outCommitment: new Array(0),

    inCommitment: new Array(0),
    inAmount: new Array(0),
    inBlinding: new Array(0),
    inPathIndices: new Array(0),
    inPathElements: new Array(0),
    inPrivateKey: new Array(0),

    outAmount: new Array(0),
    outPubkey: new Array(0),
    outBlinding: new Array(0),
  };

  let mProof: MerkleProof;
  for (const input of inputs) {
    mProof = tree.merkleProof(Number(input.index));

    proofInput.inCommitment.push(input.commitment);
    proofInput.inAmount.push(input.amounts);
    proofInput.inBlinding.push(input.blinding);
    proofInput.inPathIndices.push(mProof.pathIndices);
    proofInput.inPathElements.push(mProof.siblings);
    proofInput.inNullifier.push(input.nullifier);
    proofInput.inPrivateKey.push(input.privateKey);
  }

  const encryptedOutputs: string[] = [];
  for (const output of outputs) {
    proofInput.outAmount.push(output.amounts);
    proofInput.outPubkey.push(output.publicKey);
    proofInput.outBlinding.push(output.blinding);
    proofInput.outCommitment.push(output.commitment);
    encryptedOutputs.push("0x" + output.encryptedData);
  }

  const path = getCircuitPath(inputs.length, outputs.length);
  const { proof, publicSignals } = await plonk.fullProve(proofInput, path.circuit, path.key);
  const calldata: string = await plonk.exportSolidityCallData(proof, publicSignals);
  const proofCalldata = calldata.split(",")[0];

  const args: TransactionArgsStruct = {
    root: proofInput.inRoot,
    withdrawAmount: proofInput.withdrawAmount,
    inNullifiers: proofInput.inNullifier,
    outCommitments: proofInput.outCommitment,
    encryptedOutputs: encryptedOutputs,
    proof: proofCalldata,
  };

  return args;
}

type TransactionProofInput = {
  inRoot: bigint;
  withdrawAmount: bigint[];
  inNullifier: bigint[];
  outCommitment: bigint[];

  inCommitment: bigint[];
  inAmount: bigint[][];
  inBlinding: bigint[];
  inPathIndices: bigint[];
  inPathElements: bigint[][];
  inPrivateKey: bigint[];

  outAmount: bigint[][];
  outPubkey: bigint[];
  outBlinding: bigint[];
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
