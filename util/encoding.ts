import { EthEncryptedData } from "@metamask/eth-sig-util";
import { MAX_TOKENS } from "./constants";

const NONCE_LENGTH = 24;
const PUBKEY_LENGTH = 32;
const VERSION = "x25519-xsalsa20-poly1305";

// TODO: Compress the amount data for more efficient logging https://www.npmjs.com/package/gzip-js

export function encodeAddress(publicKey: bigint, encryptKey: string): string {
  return publicKey
    .toString(16)
    .padStart(PUBKEY_LENGTH * 2, "0")
    .concat(Buffer.from(encryptKey, "base64").toString("hex"));
}

export function decodeAddress(address: string): [bigint, string] {
  const pubkey = BigInt("0x" + address.slice(0, PUBKEY_LENGTH * 2));
  const encryptKey = Buffer.from(address.slice(PUBKEY_LENGTH * 2), "hex").toString("base64");

  return [pubkey, encryptKey];
}

export function packCommitment(amount: bigint[], blinding: bigint): string {
  let amountBuffer = Buffer.from(amount[0].toString(16).padStart(32 * 2, "0"), "hex");
  for (let amt of amount.slice(1)) {
    amountBuffer = Buffer.concat([amountBuffer, Buffer.from(amt.toString(16).padStart(32 * 2, "0"), "hex")]);
  }
  const blindingBuffer = Buffer.from(blinding.toString(16).padStart(32 * 2, "0"), "hex");
  return Buffer.concat([blindingBuffer, amountBuffer]).toString("hex");
}

export function unpackCommitment(data: string): { amounts: bigint[]; blinding: bigint } {
  const buf = Buffer.from(data, "hex");
  const blinding = BigInt("0x" + buf.subarray(0, 32).toString("hex"));
  const amounts = new Array<bigint>(MAX_TOKENS);
  for (let i = 0; i < MAX_TOKENS; i++) {
    amounts[i] = BigInt("0x" + buf.subarray(32 + i * 32, 64 + i * 32).toString("hex"));
  }
  return { amounts, blinding };
}

export function packEncryptedData(data: EthEncryptedData): string {
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

export function unpackEncryptedData(data: string): EthEncryptedData {
  const buffer = Buffer.from(data.replace("0x", ""), "hex");
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
