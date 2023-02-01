import { encrypt } from "@metamask/eth-sig-util";
import { decodeAddress } from "../util/encoding";
import { randomBytes32 } from "../util/utils";
import { Account, payToAddress } from "../util/account";

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
    const a = new Account();
    const data = randomBytes32().toString();

    const encrypted = encrypt({ publicKey: a.encryptKey, data: data, version: "x25519-xsalsa20-poly1305" });
    const packed = packEncryptedData(encrypted);
    const unpacked = unpackEncryptedData(packed);

    expect(unpacked).deep.eq(encrypted);
  });

  it("Address encoding/decoding", async () => {
    const a = new Account();
    const addr = a.getAddress();
    const [pubKey, encryptKey] = decodeAddress(addr);
    expect(pubKey).eq(a.publicKey);
    expect(encryptKey).eq(a.encryptKey);
  });

  it("Encrypt to account", async () => {
    const a = new Account();

    const generated = payToAddress(a.getAddress(), BigInt(500));
    a.attemptDecryptAndAdd(generated.utxo.commitment, generated.encrypted, BigInt(0));
    expect(a.ownedUtxos.length).eq(1);
  });
});
