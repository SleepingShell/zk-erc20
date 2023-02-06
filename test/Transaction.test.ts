import { plonk } from "snarkjs";

import { ethers } from "hardhat";
import { expect } from "chai";
import { DepositVerifier, MockERC20, ZkERC20 } from "../types";
import { Account, blank_amounts, generateZeroUtxoOutput, payToAddress } from "../util/account";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { depositProof, transactionProof } from "../util/proof";

import { CommitmentEvent, DepositEvent } from "../types/contracts/ZkERC20";

import { poseidonContract as poseidonContract } from "circomlibjs";
import { MerkleTree } from "../util/merkleProof";
import { hash } from "../util/utils";
import { BigNumber } from "ethers";

describe("Transaction proving and verification", async () => {
  const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
  const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

  let user1, user2: SignerWithAddress;
  let verifier: DepositVerifier;
  let zkerc20: ZkERC20;
  let token1: MockERC20;

  const deployVerifiers = async (zkerc20: ZkERC20) => {
    const tx1x1 = (await (await ethers.getContractFactory("Transaction1x1Verifier")).deploy()).address;
    const tx1x2 = (await (await ethers.getContractFactory("Transaction1x2Verifier")).deploy()).address;
    const tx2x2 = (await (await ethers.getContractFactory("Transaction2x2Verifier")).deploy()).address;

    await zkerc20.addVerifier(1, 1, tx1x1);
    await zkerc20.addVerifier(1, 2, tx1x2);
    await zkerc20.addVerifier(2, 2, tx2x2);
  };

  beforeEach(async () => {
    [user1, user2] = await ethers.getSigners();
    verifier = (await (await ethers.getContractFactory("DepositVerifier")).deploy()) as DepositVerifier;

    const poseidonT3LibFactory = new ethers.ContractFactory(
      poseidonContract.generateABI(2),
      poseidonContract.createCode(2),
      (await ethers.getSigners())[0]
    );
    const poseidonT3Lib = await poseidonT3LibFactory.deploy();

    const incrementalTreeLibFactory = await ethers.getContractFactory("IncrementalBinaryTree", {
      libraries: {
        PoseidonT3: poseidonT3Lib.address,
      },
    });
    const incrementalTreeLib = await incrementalTreeLibFactory.deploy();

    const zkerc20Factory = await ethers.getContractFactory("zkERC20", {
      libraries: {
        IncrementalBinaryTree: incrementalTreeLib.address,
      },
    });
    zkerc20 = (await zkerc20Factory.deploy(20, 0, verifier.address)) as ZkERC20;
    await deployVerifiers(zkerc20);

    token1 = (await (await ethers.getContractFactory("MockERC20")).deploy("Mock", "MCK")) as MockERC20;
    await token1.mint(user1.address, BigNumber.from(10).pow(18));
    await token1.connect(user1).approve(zkerc20.address, BigNumber.from(2).pow(255));
    await zkerc20.addToken(token1.address);
  });

  it("Verifier contract", async () => {
    const account1 = new Account();
    const account2 = new Account();
    const address1 = account1.getAddress();
    const address2 = account2.getAddress();
    const amount1 = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const amount2 = [200n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const output1 = payToAddress(address1, amount1);
    const output2 = payToAddress(address2, amount2);

    const input = {
      outAmounts: [amount1, amount2],
      outPubkeys: [account1.publicKey, account2.publicKey],
      outBlindings: [output1.blinding, output2.blinding],
      outCommitments: [output1.commitment, output2.commitment],
      depositAmount: amount1.map((amt, i) => amt + amount2[i]),
    };

    const { proof, publicSignals } = await plonk.fullProve(input, depositCircuitPath, depositCircuitKeyPath);

    const calldata: string = await plonk.exportSolidityCallData(proof, publicSignals);
    await expect(verifier.verifyProof(calldata.split(",")[0], publicSignals));
  });

  it("Deposit contract", async () => {
    const account1 = new Account();
    const account2 = new Account();
    const address1 = account1.getAddress();
    const address2 = account2.getAddress();
    const amount1 = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const amount2 = [200n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const output1 = payToAddress(address1, amount1);
    const output2 = payToAddress(address2, amount2);

    const args = await depositProof(
      amount1.map((amt, i) => amt + amount2[i]),
      [output1, output2]
    );

    await zkerc20.deposit(args);

    const depositFilter = zkerc20.filters.Deposit(null);
    const events = (await zkerc20.queryFilter(depositFilter)) as DepositEvent[];
    expect(events[0].args.index).eq(0);
    expect(events[0].args.commitment).eq(output1.commitment);
    expect(events[1].args.index).eq(1);
    expect(events[1].args.commitment).eq(output2.commitment);
  });

  it("Transaction contract", async () => {
    const tree = new MerkleTree(20, hash);
    const account1 = new Account();
    const account2 = new Account();
    const address1 = account1.getAddress();
    const address2 = account2.getAddress();

    const depositAmount = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const output1 = payToAddress(address1, depositAmount);
    const output2 = generateZeroUtxoOutput();

    const depositArgs = await depositProof(depositAmount, [output1, output2]);
    await zkerc20.deposit(depositArgs);

    const depositFilter = zkerc20.filters.Deposit(null);
    const events = (await zkerc20.queryFilter(depositFilter)) as DepositEvent[];

    // TODO: Whatever utility monitors the blockchain must ensure correct leaf addition order
    const toAdd: Map<bigint, bigint> = new Map();
    for (let event of events) {
      toAdd.set(event.args.index.toBigInt(), event.args.commitment.toBigInt());
      account1.attemptDecryptAndAdd(
        event.args.commitment.toBigInt(),
        event.args.encryptedData,
        event.args.index.toBigInt()
      );
    }

    const sorted = [...toAdd].sort();
    tree.addLeaves(sorted.map((v: [bigint, bigint]) => v[1]));

    expect(account1.ownedUtxos.length).eq(1);

    const amount3 = [50n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const amount4 = [50n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const txInput = account1.getKeyedUtxo(0);
    const output3 = payToAddress(address2, amount3);
    const output4 = payToAddress(address1, amount4);

    const txArgs = await transactionProof(tree, blank_amounts, [txInput], [output3, output4]);

    await zkerc20.transact(txArgs);
    const txFilter = zkerc20.filters.Commitment();
    const txevents = (await zkerc20.queryFilter(txFilter)) as CommitmentEvent[];
    for (let event of txevents) {
      console.log(event.args);
    }

    await expect(zkerc20.transact(txArgs)).revertedWith("Double spend");
  });
});
