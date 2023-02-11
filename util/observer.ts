import { BigNumber } from "ethers";
import { ZkERC20 } from "../types";
import { TypedListener } from "../types/common";
import { CommitmentEvent, CommitmentEventFilter, CommitmentEventObject } from "../types/contracts/zkERC20.sol/ZkERC20";
import { Account } from "./account";
import { MerkleTree } from "./merkleTree";

import { hash } from "./utils";

export class Observer {
  contract: ZkERC20;
  tree: MerkleTree;

  commitmentFilter: CommitmentEventFilter;
  toAdd: CommitmentEventObject[];

  /**
   * Construct a new contract observer that looks for emitted events for populating the local merkle tree
   * @param contract Instance of the zkERC20 contract
   * @param depth Depth of the merkle tree
   * @param depositAddr (optional)
   */
  constructor(contract: ZkERC20, depth: number, depositAddr = null) {
    this.contract = contract;
    this.tree = new MerkleTree(depth, hash);
    this.toAdd = [];

    this.commitmentFilter = contract.filters.Commitment();
    this.contract.on(this.commitmentFilter, (c, i, d, event) => {
      this.addOnEvent(event.args);
    });
  }

  async ready() {
    await this.initializeTree();
  }

  subscribeAccount(account: Account) {
    this.subscribe((e: CommitmentEventObject) => {
      account.attemptDecryptAndAdd(e.commitment.toBigInt(), e.encryptedData, e.index.toBigInt());
    });
  }

  // TODO: If we want to remove an account, must keep a map of account => EventListener in order to later remove

  private subscribe(callback: (e: CommitmentEventObject) => void) {
    this.contract.on(this.commitmentFilter, (c, i, d, event) => callback(event.args));
  }

  private addOnEvent(event: CommitmentEventObject) {
    if (!event.index.eq(BigNumber.from(this.tree.numLeaves))) {
      this.toAdd.push(event);
      this.toAdd = this.toAdd.sort((a, b) => a.index.sub(b.index).toNumber());
    } else {
      this.tree.addLeaves([event.commitment.toBigInt()]);

      // Attempt to add events that we've received in incorrect order
      if (this.toAdd.length > 0) {
        while (this.toAdd[0].index.eq(BigNumber.from(this.tree.numLeaves))) {
          const e = this.toAdd.splice(0, 1)[0];
          this.tree.addLeaves([e.index.toBigInt()]);
        }
      }
    }
  }

  private async initializeTree() {
    const events = await this.contract.queryFilter(this.commitmentFilter, 0, "latest");
    events.map((e) => this.addOnEvent(e));
  }
}
