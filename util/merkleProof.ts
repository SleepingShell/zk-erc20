import { buildPoseidon } from "circomlibjs";
import { getCurveFromName } from "ffjavascript";
import { HashFunction, IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import { BigNumber } from "ethers";

export async function buildMerkleTree(levels: number): Promise<MerkleTree> {
  const bn128 = await getCurveFromName("bn128", true);
  const F = bn128.Fr;
  const t = await buildPoseidon();
  const poseidon = (data: any) => F.toObject(t(data));

  return new MerkleTree(levels, poseidon, F);
}

interface Curve {
  toObject: (x :string) => bigint
}

export class MerkleTree {
  levels: number;
  tree: IncrementalMerkleTree;
  F: Curve;

  constructor(levels: number, hash: HashFunction, F: Curve) {
    this.levels = levels;
    this.F = F;
    this.tree = new IncrementalMerkleTree(hash, this.levels, 0, 2);
  }

  addLeaves(leaves: any[]) {
   leaves.map((o: any) => this.tree.insert(o));
  }

  getRoot(): string {
    return this.tree.root;
  }

  merkleProof(index: number): MerkleProof {
    const proof = this.tree.createProof(index);
    let pathIndices = BigNumber.from(0);
    for (let i = 0; i < proof.pathIndices.length; i++) {
      pathIndices = pathIndices.or(BigNumber.from(proof.pathIndices[i]).shl(i));
    }

    const proof2: MerkleProof = {
      root: proof.root,
      leaf: proof.leaf,
      siblings: proof.siblings.map((o: string[]) => o[0]),
      pathIndices: pathIndices.toString()
    }
    return proof2;
  }
}

export type MerkleProof = {
  root: string;
  leaf: string;
  siblings: string[];
  pathIndices: string;
}