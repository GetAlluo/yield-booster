import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";

async function main() {
    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    let omnivaults = ["0x2EC847395B6247Ab72b7B37432989f4547A0e947", "0xA430432eEf5C062D34e4078540b91C2ec7DBe0c9", "0xAf332f4d7A82854cB4B6345C4c133eC60c4eAd87", "0x75862d2fEdb1c6a9123F3b5d5E36D614570B404d", "0xDd7ebC54b851E629E61bc49DFcAed41C13fc67Da", "0x4eC3177F5c2500AAABE56DDbD8907d41d17Fc2E9", "0x306Df6b5D50abeD3f7bCbe7399C4b8e6BD55cB81", "0x2682c8057426FE5c462237eb3bfcfEDFb9539004"]
    for (let i = 0; i < omnivaults.length; i++) {
        await upgrades.prepareUpgrade(omnivaults[i], omniVaultFactory)
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts\omnivault\upgradeOmnivault.ts --network optimisticEthereum