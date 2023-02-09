import { plonk } from "snarkjs";

import { ethers } from "hardhat";
import { expect } from "chai";
import { DepositVerifier, MockERC20, ZkERC20, ZkERC20__factory } from "../types";
import { Account } from "../util/account";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { depositProof, transactionProof } from "../util/proof";

import { CommitmentEvent, DepositEvent } from "../types/contracts/ZkERC20";

import { poseidonContract as poseidonContract } from "circomlibjs";
import { MerkleTree } from "../util/merkleProof";
import { hash } from "../util/utils";
import { BigNumber } from "ethers";
import { addTokenToMap, UtxoOutput, zeroOutput, zeroAmounts } from "../util/utxo";

describe("Transaction proving and verification", async () => {
  const depositCircuitPath = "build/Deposit/Deposit_js/Deposit.wasm";
  const depositCircuitKeyPath = "build/Deposit/Deposit.zkey";

  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let verifier: DepositVerifier;
  let zkerc20: ZkERC20;
  let token1: MockERC20;
  let token2: MockERC20;

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
    token2 = (await (await ethers.getContractFactory("MockERC20")).deploy("Mock2", "MCK2")) as MockERC20;
    await token1.mint(user1.address, BigNumber.from(10).pow(18));
    await token1.connect(user1).approve(zkerc20.address, BigNumber.from(2).pow(255));
    await token2.mint(user1.address, BigNumber.from(10).pow(18));
    await token2.connect(user1).approve(zkerc20.address, BigNumber.from(2).pow(255));

    await zkerc20.addToken(token1.address);
    await zkerc20.addToken(token2.address);

    addTokenToMap(token1.address, 0);
    addTokenToMap(token2.address, 1);
  });

  it("Verifier contract", async () => {
    const account1 = new Account();
    const account2 = new Account();
    const address1 = account1.getAddress();
    const address2 = account2.getAddress();
    const amount1 = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const amount2 = [200n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const output1 = account1.payRaw(amount1);
    const output2 = account2.payRaw(amount2);

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
    const amount1 = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const amount2 = [200n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    const output1 = account1.payRaw(amount1);
    const output2 = account2.payRaw(amount2);

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
    expect(await token1.balanceOf(zkerc20.address)).eq(300);
  });

  it("Transaction contract", async () => {
    const tree = new MerkleTree(20, hash);
    const account1 = new Account();
    const account2 = new Account();

    const depositAmount = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const output1 = account1.payRaw(depositAmount);
    const output2 = zeroOutput();

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

    const txInput = account1.getInput(0);
    const output3 = account2.payRaw(amount3);
    const output4 = account1.payRaw(amount4);

    const txArgs = await transactionProof(tree, zeroAmounts(), [txInput], [output3, output4]);

    await zkerc20.transact(txArgs);
    const txFilter = zkerc20.filters.Commitment();
    const txevents = (await zkerc20.queryFilter(txFilter)) as CommitmentEvent[];
    /*
    for (let event of txevents) {
      console.log(event.args);
    }
    */

    await expect(zkerc20.transact(txArgs)).revertedWithCustomError(zkerc20, "DoubleSpend").withArgs(txInput.nullifier);
  });

  it("Withdraw from contract", async () => {
    const tree = new MerkleTree(20, hash);
    const account1 = new Account();

    const depositAmount = [100n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    const output1 = account1.payRaw(depositAmount);
    const output2 = zeroOutput();

    const depositArgs = await depositProof(depositAmount, [output1, output2]);
    await zkerc20.deposit(depositArgs);

    const depositFilter = zkerc20.filters.Deposit(null);
    const events = (await zkerc20.queryFilter(depositFilter)) as DepositEvent[];

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

    const output3 = zeroOutput();
    const txArgs = await transactionProof(tree, depositAmount, [account1.getInput(0)], [output3]);

    const bal = await token1.balanceOf(user1.address);
    await zkerc20.transact(txArgs);

    expect((await token1.balanceOf(user1.address)).sub(bal)).eq(depositAmount[0]);
  });

  it("Multiple token withdraw", async () => {
    const tree = new MerkleTree(20, hash);
    const account1 = new Account();
    const amount1 = 1000n;
    const amount2 = 200n;
    const bal1before = await token1.balanceOf(user1.address);
    const bal2before = await token2.balanceOf(user1.address);

    const output1 = new UtxoOutput(account1.getAddress());
    output1.setTokenAmount(token1.address, amount1);
    output1.setTokenAmount(token2.address, amount2);
    output1.finalize();
    const output2 = zeroOutput();

    const depositArgs = await depositProof(output1.amounts, [output1, output2]);
    await zkerc20.deposit(depositArgs);

    const bal1after = await token1.balanceOf(user1.address);
    const bal2after = await token2.balanceOf(user1.address);
    expect(bal1after).eq(bal1before.sub(amount1));
    expect(bal2after).eq(bal2before.sub(amount2));

    const depositFilter = zkerc20.filters.Deposit(null);
    const events = (await zkerc20.queryFilter(depositFilter)) as DepositEvent[];

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

    const withdraw1 = 600n;
    const withdraw2 = 200n;

    const output3 = account1.pay(
      {
        token: token1.address,
        amount: amount1 - withdraw1,
      },
      {
        token: token2.address,
        amount: amount2 - withdraw2,
      }
    );

    const txArgs = await transactionProof(
      tree,
      [withdraw1, withdraw2, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n],
      [account1.getInput(0)],
      [output3]
    );
    await zkerc20.transact(txArgs);

    expect(await token1.balanceOf(user1.address)).eq(bal1after.add(withdraw1));
    expect(await token2.balanceOf(user1.address)).eq(bal2after.add(withdraw2));
  });

  it("Double Spend", async () => {
    const tree = new MerkleTree(20, hash);
    const account1 = new Account();
    const amount1 = 1000n;

    const output1 = account1.pay({ token: token1.address, amount: amount1 });
    const output2 = zeroOutput();

    const depositArgs = await depositProof(output1.amounts, [output1, output2]);
    await zkerc20.deposit(depositArgs);

    const depositFilter = zkerc20.filters.Deposit(null);
    const events = (await zkerc20.queryFilter(depositFilter)) as DepositEvent[];

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

    const input = account1.getInput(0);
    const output3 = account1.pay({ token: token1.address, amount: amount1 });
    const output4 = account1.pay({ token: token1.address, amount: amount1 });

    // The circuit will approve that inputs = outputs. However, the smart contract will verify that
    // the input is being double spent
    const txArgs = await transactionProof(tree, zeroAmounts(), [input, input], [output3, output4]);

    await expect(zkerc20.transact(txArgs)).revertedWithCustomError(zkerc20, "DoubleSpend");
  });
});
