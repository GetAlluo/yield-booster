import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoVaultPool } from "../typechain";

async function main() {

    let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
    const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
    const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
    let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"

    const cvxEthVault = await ethers.getContractAt("AlluoVaultUpgradeable", "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b")
    const stEthEthVault = await ethers.getContractAt("AlluoVaultUpgradeable","0x7417e7d4369090FC49C43789116efC34c52b2D98")
    const fraxUsdcVault = await ethers.getContractAt("AlluoVaultUpgradeable", "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271");

    let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");
    let alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
        rewardToken.address,
        gnosis,
        [crv.address, cvx.address],
        [cvxEthVault.address, stEthEthVault.address, fraxUsdcVault.address],
        "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
        64, //Pool number convex
        cvx.address
    ]) as AlluoVaultPool
    console.log("AlluoPool", alluoPool.address);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVaultSepolia.ts --network mainnet