import { HashFunction } from "@zk-kit/incremental-merkle-tree";
import { decrypt, encrypt, EthEncryptedData, getEncryptionPublicKey } from "@metamask/eth-sig-util";

import { randomBytes32, getPoseidon } from "./utils";

const NONCE_LENGTH = 24;
const PUBKEY_LENGTH = 32;
const VERSION = "x25519-xsalsa20-poly1305";

export async function buildAccount(): Promise<Account> {
  return new Account(undefined, await getPoseidon());
}

class Account {
  privateKey: BigInt;
  publicKey: BigInt;
  encryptionKey: string;

  hasher: HashFunction;

  utxos: Utxo[];

  constructor(privateKey = randomBytes32(), hash: HashFunction) {
    this.privateKey = privateKey;
    this.hasher = hash;
    this.publicKey = hash([this.privateKey.toString()]);
    this.encryptionKey = getEncryptionPublicKey(this.privateKey.toString(16));
    this.utxos = [];
  }

  getEncodedAddress(): string {
    return this.publicKey
      .toString(16)
      .padStart(PUBKEY_LENGTH * 2, "0")
      .concat(Buffer.from(this.encryptionKey, "base64").toString("hex"));
  }

  // Attempts to decrypt a utxo, and if we can successfully do so, add it to the set of owned utxos
  attemptDecryptAndAdd(commitment: BigInt, data: string, index: BigInt) {
    try {
      const encryptedData = unpackEncryptedData(data);
      const packedDecrypted = decrypt({ encryptedData: encryptedData, privateKey: this.privateKey.toString(16) });
      const { amount, blinding } = unpackCommitment(packedDecrypted);
      this.utxos.push(new Utxo(commitment, amount, blinding, index));
    } catch (error) {}
  }

  getNullifier(utxo: Utxo): BigInt {
    return this.hasher([utxo.commitment, utxo.index, this.privateKey]);
  }

  generateCommitment(amount: BigInt, pubkey: BigInt, blinding: BigInt): BigInt {
    return this.hasher([amount, pubkey, blinding]);
  }

  payToAddress(
    address: string,
    amount: BigInt
  ): {
    commitment: BigInt;
    blinding: BigInt;
    encrypted: string;
  } {
    return this.generateAndEncryptCommitment(amount, ...decodeAddress(address));
  }

  /**
   * Generates a random blinding
   * Creates a commitment
   * Encrypts the data for the receiver
   * Packs the encrypted data
   *
   * @returns The commitment, blinding and encrypted data
   */
  private generateAndEncryptCommitment(
    amount: BigInt,
    pubkey: BigInt,
    encryptKey: string
  ): {
    commitment: BigInt;
    blinding: BigInt;
    encrypted: string;
  } {
    const blinding = randomBytes32();
    const commitment = this.generateCommitment(amount, pubkey, blinding);
    const encryptedData = encrypt({
      publicKey: encryptKey,
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

export function decodeAddress(address: string): [BigInt, string] {
  const pubkey = BigInt("0x" + address.slice(0, PUBKEY_LENGTH * 2));
  const encryptKey = Buffer.from(address.slice(PUBKEY_LENGTH * 2), "hex").toString("base64");

  return [pubkey, encryptKey];
}

function packCommitment(amount: BigInt, blinding: BigInt): string {
  const amountBuffer = Buffer.from(amount.toString(16).padStart(32 * 2, "0"), "hex");
  const blindingBuffer = Buffer.from(blinding.toString(16).padStart(32 * 2, "0"), "hex");
  return Buffer.concat([amountBuffer, blindingBuffer]).toString("hex");
}

function unpackCommitment(data: string): { amount: BigInt; blinding: BigInt } {
  const buf = Buffer.from(data, "hex");
  const amount = BigInt("0x" + buf.subarray(0, 32).toString("hex"));
  const blinding = BigInt("0x" + buf.subarray(32, 64).toString("hex"));
  return { amount, blinding };
}

function packEncryptedData(data: EthEncryptedData): string {
  const nonce = Buffer.from(data.nonce, "base64");
  const ephemPublicKey = Buffer.from(data.ephemPublicKey, "base64");
  const ciphertext = Buffer.from(data.ciphertext, "base64");

  const packed = Buffer.concat([
    Buffer.alloc(NONCE_LENGTH - nonce.length),
    nonce,
    Buffer.alloc(32 - ephemPublicKey.length),
    ephemPublicKey,
    ciphertext,
  ]);

  return packed.toString("hex");
}

function unpackEncryptedData(data: string): EthEncryptedData {
  const buffer = Buffer.from(data, "hex");
  const nonce = buffer.subarray(0, NONCE_LENGTH);
  const ephemPublicKey = buffer.subarray(NONCE_LENGTH, NONCE_LENGTH + 32);
  const ciphertext = buffer.subarray(NONCE_LENGTH + 32);
  return {
    version: VERSION,
    nonce: nonce.toString("base64"),
    ephemPublicKey: ephemPublicKey.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

class Utxo {
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
