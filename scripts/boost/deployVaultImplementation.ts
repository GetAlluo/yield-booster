import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")

    const cvxEthVault = await ethers.getContractAt("AlluoVaultUpgradeable", "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b")
    const stEthEthVault = await ethers.getContractAt("AlluoVaultUpgradeable","0x7417e7d4369090FC49C43789116efC34c52b2D98")
    const fraxUsdcVault = await ethers.getContractAt("AlluoVaultUpgradeable", "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271");

    await upgrades.prepareUpgrade(cvxEthVault.address, AlluoVaultFactory)
    await upgrades.prepareUpgrade(stEthEthVault.address, AlluoVaultFactory ,{useDeployedImplementation: true})
    await upgrades.prepareUpgrade(fraxUsdcVault.address, AlluoVaultFactory,{useDeployedImplementation: true})
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVaultSepolia.ts --network mainnet