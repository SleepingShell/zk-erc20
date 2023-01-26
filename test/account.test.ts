import { encrypt } from "@metamask/eth-sig-util";
import { buildAccount, decodeAddress } from "../util/account";
import { randomBytes32 } from "../util/utils";

import { expect } from "chai";

import { exportedForTesting } from "../util/account";
const { packCommitment, unpackCommitment, packEncryptedData, unpackEncryptedData } = exportedForTesting;

describe("Account related actions", async () => {
  it("Packing commitment functions", async () => {
    const realAmount = BigInt(100000);
    const realBlinding = randomBytes32();

    const packedCommit = packCommitment(realAmount, realBlinding);
    const { amount, blinding } = unpackCommitment(packedCommit);

    expect(amount).eq(realAmount);
    expect(blinding).eq(realBlinding);
  });

  it("Packing encrypted data functions", async () => {
    const a = await buildAccount();
    const data = randomBytes32().toString();

    const encrypted = encrypt({ publicKey: a.encryptionKey, data: data, version: "x25519-xsalsa20-poly1305" });
    const packed = packEncryptedData(encrypted);
    const unpacked = unpackEncryptedData(packed);

    expect(unpacked).deep.eq(encrypted);
  });

  it("Address encoding/decoding", async () => {
    const a = await buildAccount();
    const addr = a.getEncodedAddress();
    const [pubKey, encryptKey] = decodeAddress(addr);
    expect(pubKey).eq(a.publicKey);
    expect(encryptKey).eq(a.encryptionKey);
  });

  it("Encrypt to account", async () => {
    const a = await buildAccount();
    const b = await buildAccount();

    const generated = a.payToAddress(b.getEncodedAddress(), BigInt(500));
    //const generated = a.generateAndEncryptCommitment(BigInt(500), b.publicKey, b.encryptionKey);
    b.attemptDecryptAndAdd(generated.commitment, generated.encrypted, BigInt(0));
    expect(b.utxos.length).eq(1);
  });
});
