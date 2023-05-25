import { ethers, upgrades } from "hardhat"
import { AlluoLockedVault } from "../typechain";

async function main() {

  const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
  const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
  const fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0");
  const alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
  const rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
  const cvxCrvFraxBPlp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x527331f3f550f6f85acfecab9cc0889180c6f1d5");
  const cvxCrvFraxBPPool = await ethers.getContractAt("IFraxFarmERC20", "0x57c9F019B25AaAF822926f4Cacf0a860f61eDd8D");
  let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"


  let AlluoLockedVault = await ethers.getContractFactory("AlluoLockedVault")
  let AlluoVault = await upgrades.deployProxy(AlluoLockedVault, [
    "cvxCrv-FraxBP Vault",
    "abCvxCrv-FraxBP",
    cvxCrvFraxBPlp.address, // underlying token
    rewardToken.address, // Curve CVX-ETH Convex Deposit (cvxcrvCVX...)
    alluoPool.address,
    gnosis,
    "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
    [crv.address, cvx.address, fxs.address], // yield tokens
    cvxCrvFraxBPPool.address
  ], {
    initializer: 'initialize',
    kind: 'uups'
  }) as AlluoLockedVault;

  console.log("Alluo cvxCrv-FraxB Vault deployed at:", AlluoVault.address);


}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/deployCVXyCRVVault.ts --network mainnet