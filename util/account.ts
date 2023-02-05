import { HashFunction } from "@zk-kit/incremental-merkle-tree";
import { decrypt, encrypt, EthEncryptedData, getEncryptionPublicKey } from "@metamask/eth-sig-util";

import { randomBytes32, hash } from "./utils";
import { MAX_TOKEN_TYPES, VERSION } from "./constants";

import {
  encodeAddress,
  decodeAddress,
  unpackEncryptedData,
  unpackCommitment,
  packCommitment,
  packEncryptedData,
} from "./encoding";
import { randomBytes } from "crypto";

const blank_amounts = new Array<bigint>(MAX_TOKEN_TYPES).fill(0n);

export class Account {
  privateKey: bigint;
  publicKey: bigint;
  encryptKey: string;

  ownedUtxos: Utxo[];

  constructor(privateKey = randomBytes32()) {
    this.privateKey = privateKey;
    this.publicKey = hash([this.privateKey.toString()]);
    this.encryptKey = getEncryptionPublicKey(this.privateKey.toString(16));
    this.ownedUtxos = [];
  }

  static fromAddress(address: string): Account {
    if (address.length != 128) {
      throw "Invalid address";
    }

    const [pubkey, encryptkey] = decodeAddress(address);
    return Object.assign(new Account(undefined), {
      privateKey: null,
      publicKey: pubkey,
      encryptKey: encryptkey,
      ownedUtxos: null,
    });
  }

  getAddress(): string {
    return encodeAddress(this.publicKey, this.encryptKey);
  }

  // Attempts to decrypt a utxo, and if we can successfully do so, add it to the set of owned utxos
  attemptDecryptAndAdd(commitment: bigint, data: string, index: bigint) {
    try {
      const encryptedData = unpackEncryptedData(data);
      const packedDecrypted = decrypt({ encryptedData: encryptedData, privateKey: this.privateKey.toString(16) });
      const { amount, blinding } = unpackCommitment(packedDecrypted);

      const utxo = new Utxo(commitment, amount, blinding, index);
      utxo.setNullifier(this.privateKey);
      this.ownedUtxos.push(utxo);
    } catch (error) {}
  }

  /**
   * Generates a commitment destined for this account
   *
   * Generates a random blinding
   * Creates a commitment
   * Encrypts the data for the receiver
   * Packs the encrypted data
   *
   * @returns The commitment, blinding and encrypted data
   */
  generateAndEncryptCommitment(amount: bigint[]): UtxoOutput {
    const blinding = randomBytes32();
    const commitment = generateCommitment(amount, this.publicKey, blinding);
    const encryptedData = encrypt({
      publicKey: this.encryptKey,
      data: packCommitment(amount, blinding),
      version: VERSION,
    });

    return new UtxoOutput(commitment, amount, blinding, this.publicKey, packEncryptedData(encryptedData));
  }

  getKeyedUtxo(arrIndex: number): UtxoWithKey {
    const u: UtxoWithKey = Object.assign({}, this.ownedUtxos[arrIndex], { privateKey: this.privateKey });
    return u;
  }
}

export function generateZeroUtxoOutput(): UtxoOutput {
  const blinding = randomBytes32();
  return new UtxoOutput(
    generateCommitment(blank_amounts, 0n, blinding),
    blank_amounts,
    blinding,
    0n,
    randomBytes(400).toString("hex")
  );
}

export function generateCommitment(amount: bigint[], pubkey: bigint, blinding: bigint): bigint {
  return hash([...amount, pubkey, blinding]);
}

export function payToAddress(address: string, amount: bigint[]): UtxoOutput {
  return Account.fromAddress(address).generateAndEncryptCommitment(amount);
}

// Change amount to array. The only method to get a fixed length array is to use tuples.
// However, we may not care to do that, since it will just result in an invalid proof
export class Utxo {
  commitment: bigint;
  amount: bigint[];
  blinding: bigint;
  index: bigint;
  nullifier: bigint;

  constructor(commitment: bigint, amount: bigint[], blinding: bigint = 0n, index: bigint = -1n) {
    if (amount.length != MAX_TOKEN_TYPES) {
      throw Error("Must have the correct number of amounts");
    }
    this.commitment = commitment;
    this.amount = amount;
    this.blinding = blinding;
    this.index = index;
    this.nullifier = 0n;
  }

  /**
   * Sets the nullifier for this utxo with the given private key.
   * Does NOT check that the private key is the proper owner
   *
   * @param privateKey key used to generate the nullifier
   */
  setNullifier(privateKey: bigint) {
    if (this.index == -1n) {
      throw new Error("Invalid index");
    }
    this.nullifier = hash([this.commitment, this.index, privateKey]);
  }

  setIndex(index: bigint) {
    this.index = index;
  }
}

export class UtxoOutput extends Utxo {
  pubkey: bigint;
  encryptedData: string;

  constructor(commitment: bigint, amount: bigint[], blinding: bigint, pubkey: bigint, encryptedData: string) {
    super(commitment, amount, blinding);
    this.pubkey = pubkey;
    this.encryptedData = encryptedData;
  }
}

export class UtxoWithKey extends Utxo {
  privateKey: bigint;

  constructor(commitment: bigint, amount: bigint[], blinding: bigint, index: bigint, privateKey: bigint) {
    super(commitment, amount, blinding, index);
    this.privateKey = privateKey;
    super.setNullifier(privateKey);
  }
}

export const exportedForTesting = {
  packCommitment,
  unpackCommitment,
  packEncryptedData,
  unpackEncryptedData,
};
