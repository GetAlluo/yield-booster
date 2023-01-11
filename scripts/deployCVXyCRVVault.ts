import { ethers, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

  let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
  let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
  const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
  const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
  const yCRVPool = await ethers.getContractAt("ICurvePool", "0x453d92c7d4263201c69aacfaf589ed14202d83a4");
  const yCRVToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x453d92c7d4263201c69aacfaf589ed14202d83a4");
  const ycrv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xfcc5c47be19d06bf83eb04298b026f81069ff65b");
  const alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
  let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"

  let AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
    "CRV-yCRV Vault",
    "yCRV",
    yCRVToken.address, // underlying
    rewardToken.address, // like in other contracts
    alluoPool.address,
    gnosis,
    "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
    [crv.address, cvx.address], // 
    [crv.address, ycrv.address], // entry tokens to curve pool
    124,
    yCRVPool.address
  ], {
    initializer: 'initialize',
    kind: 'uups'
  }) as AlluoVaultUpgradeable;

  console.log("Alluo Dola-FraxBP Vault deployed at:", AlluoVault.address);


}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deployCVXyCRVVault.ts --network mainnet