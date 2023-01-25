import { decrypt, getEncryptionPublicKey } from "@metamask/eth-sig-util";
import { BigNumber } from "ethers";
import { buildAccount, testEncrypt } from "../util/account";
import { randomBytes32 } from "../util/utils";

import { expect } from "chai";

import { exportedForTesting } from "../util/account";
const { packCommitment, unpackCommitment, packEncryptedData, unpackEncryptedData } = exportedForTesting;

describe.only("Account related actions", async () => {
  it("Packing functions", async () => {
    const realAmount = BigNumber.from(100000);
    const realBlinding = randomBytes32();

    const packedCommit = packCommitment(realAmount, realBlinding);
    console.log('packed', packedCommit);
    const { amount, blinding } = unpackCommitment(packedCommit);

    expect(amount).eq(realAmount);
    expect(blinding).eq(realBlinding);
  });
})