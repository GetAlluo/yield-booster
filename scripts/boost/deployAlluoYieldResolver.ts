import { ethers } from "hardhat"
import { AlluoYieldResolver } from "../typechain";

async function main() {
    let maxGas = 15 * 10 ** 9;
    let stakeTime = 86400;
    let farmTime = 86400 * 7;
    let alluoVaults = [
      "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b",
      "0x7417e7d4369090FC49C43789116efC34c52b2D98",
      "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271",
    ];
    let alluoPools = ["0x470e486acA0e215C925ddcc3A9D446735AabB714"];
    let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";

    let AlluoYieldResolverFactory = await ethers.getContractFactory("AlluoYieldResolver");
    let alluoYieldResolver = await AlluoYieldResolverFactory.deploy(
        maxGas,
        stakeTime,
        farmTime,
        alluoVaults,
        alluoPools,
        gnosis
    );
    console.log("AlluoYieldResolver", alluoYieldResolver.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat verify --network goerli 0x6D4c38650e33b860855cbDF3E2e29D761344fF17 --constructor-args alluoYieldResolverArguments.js