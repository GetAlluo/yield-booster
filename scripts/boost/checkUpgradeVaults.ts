import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")

    const vaultsArray = ["0x910c98B3EAc2B4c3f6FdB81882bfd0161e507567", "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b", "0x1EE566Fd6918101C578a1d2365d632ED39BEd740", "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271", "0x7417e7d4369090FC49C43789116efC34c52b2D98"]
    for (let i = 0; i < vaultsArray.length; i++) {
        console.log(await upgrades.validateUpgrade(vaultsArray[i], AlluoVaultFactory))
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet