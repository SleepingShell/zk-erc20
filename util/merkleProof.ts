import { buildPoseidon } from "circomlibjs";
import { getCurveFromName } from "ffjavascript";
import { HashFunction, IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";

export async function buildMerkleTree(levels: number): Promise<MerkleTree> {
  const bn128 = await getCurveFromName("bn128", true);
  const F = bn128.Fr;
  const t = await buildPoseidon();
  const poseidon = (data) => F.toObject(t(data));

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
    this.tree = new IncrementalMerkleTree(hash, this.levels, "", 2);
  }

  addLeaves(leaves: string[]) {
    //const leavesF: string[] = leaves.map((o: string) => F.toObject(o).toString());
    //this.tree.insert(leavesF);

    //leaves.map((o: string) => this.tree.insert(F.toObject(o)));
    for (let leaf in leaves) {
      this.tree.insert(leaf);
    }

    console.log('length', this.tree.leaves.length);
  }

  getRoot(): string {
    //return F.toObject(this.tree.root).toString();
    return this.tree.root;
  }
}