import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";

async function main() {
    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
    const USDOmnivault = await ethers.getContractAt("AlluoOmnivault", "0xC7DBb63DceB6B20128FaB55797FD7AA832694867");
    await USDOmnivault.deposit(usdc.address, ethers.utils.parseUnits("10", 6));
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet