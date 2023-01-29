import { HashFunction } from "@zk-kit/incremental-merkle-tree";
import { decrypt, encrypt, EthEncryptedData, getEncryptionPublicKey } from "@metamask/eth-sig-util";

import { randomBytes32, hash } from "./utils";

import {
  encodeAddress,
  decodeAddress,
  unpackEncryptedData,
  unpackCommitment,
  packCommitment,
  packEncryptedData,
} from "./encoding";

const VERSION = "x25519-xsalsa20-poly1305";

export class Account {
  privateKey: BigInt;
  publicKey: BigInt;
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
  attemptDecryptAndAdd(commitment: BigInt, data: string, index: BigInt) {
    try {
      const encryptedData = unpackEncryptedData(data);
      const packedDecrypted = decrypt({ encryptedData: encryptedData, privateKey: this.privateKey.toString(16) });
      const { amount, blinding } = unpackCommitment(packedDecrypted);
      this.ownedUtxos.push(new Utxo(commitment, amount, blinding, index));
    } catch (error) {}
  }

  getNullifier(commitment: BigInt, index: BigInt): BigInt {
    return hash([commitment, index, this.privateKey]);
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
  generateAndEncryptCommitment(amount: BigInt): {
    commitment: BigInt;
    blinding: BigInt;
    encrypted: string;
  } {
    const blinding = randomBytes32();
    const commitment = generateCommitment(amount, this.publicKey, blinding);
    const encryptedData = encrypt({
      publicKey: this.encryptKey,
      data: packCommitment(amount, blinding),
      version: VERSION,
    });
    return {
      commitment: commitment,
      blinding: blinding,
      encrypted: packEncryptedData(encryptedData),
    };
  }
}

export function generateCommitment(amount: BigInt, pubkey: BigInt, blinding: BigInt): BigInt {
  return hash([amount, pubkey, blinding]);
}

export function payToAddress(
  address: string,
  amount: BigInt
): {
  commitment: BigInt;
  blinding: BigInt;
  encrypted: string;
} {
  return Account.fromAddress(address).generateAndEncryptCommitment(amount);
}

export class Utxo {
  commitment: BigInt;

  amount: BigInt;
  blinding: BigInt;

  index: BigInt;

  constructor(commitment: BigInt, amount: BigInt, blinding: BigInt, index: BigInt) {
    this.commitment = commitment;
    this.amount = amount;
    this.blinding = blinding;
    this.index = index;
  }
}

export const exportedForTesting = {
  packCommitment,
  unpackCommitment,
  packEncryptedData,
  unpackEncryptedData,
};
