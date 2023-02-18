import { task } from "hardhat/config";
import { IzkERC20 } from "../types";

task("addToken", "Adds a token that can be transacted with")
  .addParam("zkerc20", "Address of zkERC20")
  .addParam("token", "Address of the token to add")
  .setAction(async ({ zkerc20, token }, hre) => {
    const zkerc20Contract = (await hre.ethers.getContractAt("IzkERC20", zkerc20)) as IzkERC20;
    const tx = await zkerc20Contract.addToken(token);
    console.log(`Added token ${token} with txid ${(await tx.wait()).transactionHash}`);
  });
