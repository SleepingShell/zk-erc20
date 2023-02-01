import { HashFunction, IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { BigNumber } from "ethers";

import { hash } from "./utils";

export async function buildMerkleTree(levels: number): Promise<MerkleTree> {
  return new MerkleTree(levels, hash);
}

export class MerkleTree {
  levels: number;
  tree: IncrementalMerkleTree;

  constructor(levels: number, hash: HashFunction) {
    this.levels = levels;
    this.tree = new IncrementalMerkleTree(hash, this.levels, 0, 2);
  }

  addLeaves(leaves: any[]) {
    leaves.map((o: any) => this.tree.insert(o));
  }

  setLeaf(index: number, leaf: any) {
    this.tree.update(index, leaf);
  }

  getRoot(): bigint {
    return this.tree.root;
  }

  merkleProof(index: number): MerkleProof {
    const proof = this.tree.createProof(index);
    let pathIndices = BigInt(0);
    for (let i = 0; i < proof.pathIndices.length; i++) {
      pathIndices |= BigInt(proof.pathIndices[i]) << BigInt(i);
    }

    const proof2: MerkleProof = {
      root: proof.root,
      leaf: proof.leaf,
      siblings: proof.siblings.map((o: bigint[]) => o[0]),
      pathIndices: pathIndices,
    };
    return proof2;
  }
}

export type MerkleProof = {
  root: bigint;
  leaf: bigint;
  siblings: bigint[];
  pathIndices: bigint;
};
