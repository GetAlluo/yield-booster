import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoRewardsDistributor, AlluoVaultPool } from "../typechain";

async function main() {
    let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
    let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"
    let alluoPool1 = "0x470e486acA0e215C925ddcc3A9D446735AabB714"
    let Rewards = await ethers.getContractFactory("AlluoRewardsDistributor");
    let rewardsDistributor = await upgrades.deployProxy(Rewards, [
        rewardToken.address,
        [alluoPool1],
        gnosis
    ]) as AlluoRewardsDistributor;
    console.log("RewardsDistributor at", rewardsDistributor.address);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/deployRewardsDistributor.ts --network mainnet