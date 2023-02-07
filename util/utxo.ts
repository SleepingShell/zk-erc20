import { randomBytes32, hash } from "./utils";
import { decodeAddress, encodeAddress, packCommitment, packEncryptedData } from "./encoding";
import { MAX_TOKENS, VERSION } from "./constants";
import { encrypt, getEncryptionPublicKey } from "@metamask/eth-sig-util";
import { randomBytes } from "crypto";

// Helper for determining where a token is in the array of amounts
const token_map: Map<string, number> = new Map();

export function addTokenToMap(token: string, index: number) {
  if (token_map.get(token) != undefined) {
    if (token_map.get(token) != index) {
      throw Error("Changing already existing token index");
    }
  }
  token_map.set(token, index);
}

const zero_amounts = new Array<bigint>(MAX_TOKENS).fill(0n);
export const zeroAmounts = () => [...zero_amounts];

export type TokenAmount = { token: string; amount: bigint };

/**
 * A UtxoInput is read from the DA layer and therefore cannot change any of its properties. All values
 * passed in the constructor are assumed to be correct.
 */
export class UtxoInput {
  commitment: bigint;
  amounts: bigint[];
  blinding: bigint;
  index: bigint;
  privateKey: bigint;
  nullifier: bigint;

  constructor(commitment: bigint, amounts: bigint[], blinding: bigint, index: bigint, privkey: bigint) {
    if (amounts.length != MAX_TOKENS) {
      throw Error("Must have the correct number of amounts");
    }
    this.commitment = commitment;
    this.amounts = amounts;
    this.blinding = blinding;
    this.index = index;
    this.privateKey = privkey;
    this.nullifier = this.generateNullifier(privkey);
  }

  private generateNullifier(privateKey: bigint): bigint {
    return hash([this.commitment, this.index, privateKey]);
  }

  static fromOutput(output: UtxoOutput, index: bigint, privateKey: bigint): UtxoInput {
    return new UtxoInput(output.commitment, output.amounts, output.blinding, index, privateKey);
  }
}

/**
 * A UtxoOutput is created for payment to an address. A random blinding is created on construction,
 * and the commitmen+encrypted data should not be considered valid until the output has been finalized.
 */
export class UtxoOutput {
  commitment: bigint = 0n;
  amounts: bigint[];
  publicKey: bigint;
  blinding: bigint;

  encryptionKey: string;
  encryptedData: string = "";

  isFinalized: boolean;

  constructor(address: string, amounts: bigint[] = zeroAmounts()) {
    if (amounts.length != MAX_TOKENS && amounts.length != 0) {
      throw Error("Amount array has incorrect length");
    }
    this.amounts = amounts;
    [this.publicKey, this.encryptionKey] = decodeAddress(address);
    this.blinding = randomBytes32();
    this.isFinalized = false;
  }

  setTokenAmount(token: string, amount: bigint) {
    this.checkFinalized();
    const index = token_map.get(token);
    if (index === undefined) {
      throw Error("Unknown token");
    }
    this.amounts[index] = amount;
  }

  generateCommitment() {
    this.commitment = hash([...this.amounts, this.publicKey, this.blinding]);
  }

  /**
   * An output cannot be modified after being finalized. A fake output will create random encrypted data
   *
   * @param real If a fake output is being created, than this is false and encryptedData is random
   */
  finalize(real: boolean = true) {
    this.generateCommitment();
    this.isFinalized = true;
    if (!real) {
      this.encryptedData = randomBytes(400).toString("hex"); // FIXME: Calc random data length based on # of tokens
      return;
    }
    this.encryptedData = packEncryptedData(
      encrypt({
        publicKey: this.encryptionKey,
        data: packCommitment(this.amounts, this.blinding),
        version: VERSION,
      })
    );
  }

  checkFinalized() {
    if (this.isFinalized) {
      throw Error("Cannot modify finalized output");
    }
  }
}

export function zeroOutput(): UtxoOutput {
  const output = new UtxoOutput(encodeAddress(0n, getEncryptionPublicKey("".padEnd(64, "0"))));
  output.finalize(false);
  return output;
}
