import { BigNumber } from "ethers";
import { task } from "hardhat/config";
import { MockERC20, ZkERC20 } from "../types";
import { Account } from "../util/account";
import { MAX_TOKENS } from "../util/constants";
import { depositProof } from "../util/proof";
import { addTokenToMap, zeroOutput } from "../util/utxo";

task("deposit", "Deposits a token")
  .addParam("zkerc20", "Address of zkERC20")
  .addParam("token", "Address of the token to deposit")
  .addParam("amount", "Amount of token to deposit")
  .addParam("address", "address of account")
  .setAction(
    async (
      { zkerc20, token, amount, address }: { zkerc20: string; token: string; amount: bigint; address: string },
      hre
    ) => {
      const zkerc20Contract = (await hre.ethers.getContractAt("zkERC20", zkerc20)) as ZkERC20;
      const tokenContract = (await hre.ethers.getContractAt("MockERC20", token)) as MockERC20;
      const [sender] = await hre.ethers.getSigners();
      for (let i = 0; i < MAX_TOKENS; i++) {
        try {
          const res = await zkerc20Contract.tokens(i);
          if (res == token) {
            addTokenToMap(token, i);
          }
        } catch (e) {
          new Error("Invalid token");
        }
      }

      if ((await tokenContract.allowance(zkerc20, sender.address)) < BigNumber.from(amount)) {
        console.log("Approving zkerc20 to spend token");
        await tokenContract.approve(zkerc20, BigNumber.from(2).shl(250));
      }

      const acc = Account.fromAddress(address);
      const output = acc.pay({ token: token, amount: amount });
      const output2 = zeroOutput();

      console.log("Generating proof...");
      const args = await depositProof(output.amounts, [output, output2]);
      const tx = await zkerc20Contract.deposit(args);

      console.log(`Output1: \t${output.commitment}`);
      console.log(`Output2: \t${output2.commitment}`);
      console.log(`Tx: ${(await tx.wait()).transactionHash}`);
    }
  );
