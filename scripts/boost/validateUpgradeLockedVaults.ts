import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultFactory = await ethers.getContractFactory("AlluoLockedVault")

    const vaultsArray = ["0xF213303D5Ff30c5E12f4fEdf8491f45e7C232f8D", "0x62E0B61e1891Df4bDb77B1d19fc227cCeF969eC6"]
    let deployedImplemnetation = false
    for (let i = 0; i < vaultsArray.length; i++) {
        if (i >= 1) {
            deployedImplemnetation = true
        }
        console.log(await upgrades.prepareUpgrade(vaultsArray[i], AlluoVaultFactory, { useDeployedImplementation: deployedImplemnetation }))
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet