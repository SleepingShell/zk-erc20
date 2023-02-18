import { task } from "hardhat/config";

task("deployMock", "Deploy a mock token that anyone can mint").setAction(async (args, hre) => {
  const mock = await (await ethers.getContractFactory("MockERC20")).deploy("Mock", "MCK");
  console.log(`Token deployed to: ${mock.address}`);
});
