import { encrypt } from "@metamask/eth-sig-util";
import {
  decodeAddress,
  packCommitment,
  packEncryptedData,
  unpackCommitment,
  unpackEncryptedData,
} from "../util/encoding";
import { randomBytes32 } from "../util/utils";
import { Account } from "../util/account";

import { expect } from "chai";

//import { exportedForTesting } from "../util/account";
//const { packCommitment, unpackCommitment, packEncryptedData, unpackEncryptedData } = exportedForTesting;

describe("Account related actions", async () => {
  it("Packing commitment functions", async () => {
    const realAmounts = [100000n, 0n, 0n, 50n, 0n, 0n, 0n, 5828n, 0n, 0n];
    const realBlinding = randomBytes32();

    const packedCommit = packCommitment(realAmounts, realBlinding);
    const { amounts, blinding } = unpackCommitment(packedCommit);

    expect(amounts).deep.eq(realAmounts);
    expect(blinding).eq(realBlinding);
  });

  it("Packing encrypted data functions", async () => {
    const a = new Account();
    const data = randomBytes32().toString();

    const encrypted = encrypt({ publicKey: a.encryptionKey, data: data, version: "x25519-xsalsa20-poly1305" });
    const packed = packEncryptedData(encrypted);
    const unpacked = unpackEncryptedData(packed);

    expect(unpacked).deep.eq(encrypted);
  });

  it("Address encoding/decoding", async () => {
    const a = new Account();
    const addr = a.getAddress();
    const [pubKey, encryptKey] = decodeAddress(addr);
    expect(pubKey).eq(a.publicKey);
    expect(encryptKey).eq(a.encryptionKey);
  });

  /*
  it("Encrypt to account", async () => {
    const a = new Account();

    const generated = a.pay([0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
    a.attemptDecryptAndAdd(generated.commitment, generated.encryptedData, 0n);
    expect(a.ownedUtxos.length).eq(1);
  });
  */
});
