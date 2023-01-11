import { ethers, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

  let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
  let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
  const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
  const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
  const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
  const dolaFraxbpToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE57180685E3348589E9521aa53Af0BCD497E884d");
  const dolaStableCoin = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x865377367054516e17014CcdED1e7d814EDC9ce4");
  const fraxBP = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
  const alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
  let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"

  let AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
    "Dola-FraxBP Vault",
    "dolaFrax",
    dolaFraxbpToken.address, // underlying token
    rewardToken.address,// like in other contracts
    alluoPool.address, // set pool later
    gnosis,
    "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
    [crv.address, cvx.address], // 
    [dolaStableCoin.address, fraxBP.address, usdc.address], // entry tokens to curve pool
    115,
    dolaFraxbpToken.address
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

//npx hardhat run scripts/deployDolaFraxVault.ts --network mainnet