import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultPool = await ethers.getContractFactory("AlluoVaultPool")
    console.log(await upgrades.prepareUpgrade("0x470e486acA0e215C925ddcc3A9D446735AabB714", AlluoVaultPool))
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet