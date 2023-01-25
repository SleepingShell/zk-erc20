import { HashFunction } from "@zk-kit/incremental-merkle-tree";
import { BigNumber, BigNumberish, Bytes, BytesLike } from "ethers";
import { decrypt, encrypt, EthEncryptedData, getEncryptionPublicKey } from "@metamask/eth-sig-util";

import { randomBytes32, getPoseidon } from "./utils";

const NONCE_LENGTH = 24;
const VERSION = 'x25519-xsalsa20-poly1305';

export async function buildAccount(): Promise<Account> {
  return new Account(undefined, await getPoseidon());
}

class Account {
  privateKey: BigNumber
  publicKey: BigNumber
  encryptionKey: string

  hasher: HashFunction

  utxos: Utxo[]

  constructor(privateKey = randomBytes32(), hash: HashFunction) {
    this.privateKey = privateKey;
    this.hasher = hash;
    this.publicKey = hash([this.privateKey.toString()]);
    this.encryptionKey = getEncryptionPublicKey(this.privateKey.toHexString().slice(2))
    this.utxos = []
  }

  // Attempts to decrypt a utxo, and if we can successfully do so, add it to the set of owned utxos
  attemptDecryptAndAdd(commitment: BigNumber, data: string, index: BigNumberish) {
    try {
      const encryptedData = unpackEncryptedData(data);
      const packedDecrypted = decrypt({encryptedData: encryptedData, privateKey: this.privateKey.toHexString().slice(2)});
      const { amount, blinding } = unpackCommitment(packedDecrypted);
      this.utxos.push(new Utxo(commitment, amount, blinding, index));
    } catch (error) {
    }
  }

  getNullifier(utxo: Utxo): BigNumber {
    return this.hasher([utxo.commitment, utxo.index, this.privateKey]);
  }

  generateCommitment(amount: BigNumber, pubkey: BigNumber, blinding: BigNumber): BigNumber {
    return this.hasher([amount, pubkey, blinding]);
  }

  // TODO: Need to create a scheme that combines normal publickey + encryptKey
  /**
   * Generates a random blinding
   * Creates a commitment
   * Encrypts the data for the receiver
   * Packs the encrypted data
   * 
   * @returns The commitment, blinding and encrypted data
   */
  generateAndEncryptCommitment(
    amount: BigNumber,
    pubkey: BigNumber,
    encryptKey: string
  ): {
    commitment: BigNumber
    blinding: BigNumber
    encrypted: string
  } {
    const blinding = randomBytes32();
    const commitment = this.generateCommitment(amount, pubkey, blinding);
    const encryptedData = encrypt({
      publicKey: encryptKey.toString(),
      data: packCommitment(amount, blinding),
      version: VERSION
    });
    return {
      commitment: commitment,
      blinding: blinding,
      encrypted: packEncryptedData(encryptedData)
    }
  }
}

function packCommitment(amount: BigNumber, blinding: BigNumber): string {
  const amountBuffer = Buffer.from(amount.toHexString().slice(2).padStart(32*2,'0'), 'hex');
  const blindingBuffer = Buffer.from(blinding.toHexString().slice(2).padStart(32*2,'0'), 'hex');
  return Buffer.concat([amountBuffer, blindingBuffer]).toString('hex');
}

function unpackCommitment(data: string): {amount: BigNumber, blinding: BigNumber} {
  const buf = Buffer.from(data, 'hex')
  const amount = BigNumber.from('0x' + buf.subarray(0, 32).toString('hex'));
  const blinding = BigNumber.from('0x' + buf.subarray(32, 64).toString('hex'));
  return { amount, blinding }
}

function packEncryptedData(data: EthEncryptedData): string {
  const nonce = Buffer.from(data.nonce, 'base64');
  const ephemPublicKey = Buffer.from(data.ephemPublicKey, 'base64');
  const ciphertext = Buffer.from(data.ciphertext, 'base64');

  const packed = Buffer.concat([
    Buffer.alloc(NONCE_LENGTH - nonce.length),
    nonce,
    Buffer.alloc(32 - ephemPublicKey.length),
    ephemPublicKey,
    ciphertext
  ]);

  return packed.toString('hex');
}

function unpackEncryptedData(data: string): EthEncryptedData {
  const buffer = Buffer.from(data, 'hex');
  const nonce = buffer.subarray(0, NONCE_LENGTH);
  const ephemPublicKey = buffer.subarray(NONCE_LENGTH, NONCE_LENGTH+32);
  const ciphertext = buffer.subarray(NONCE_LENGTH+32);
  return {
    version: VERSION,
    nonce: nonce.toString('base64'),
    ephemPublicKey: ephemPublicKey.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

class Utxo {
  commitment: BigNumberish

  amount: BigNumberish
  blinding: BigNumberish

  index: BigNumberish

  constructor(commitment: BigNumber, amount: BigNumberish, blinding: BigNumberish, index: BigNumberish) {
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
  unpackEncryptedData
}