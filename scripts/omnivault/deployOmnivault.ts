import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";

async function main() {
    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
    const mooLp1 = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x0892a178c363b4739e5Ac89E9155B9c30214C0c0');
    const lp1BoostAddress = "0x358b7d1a3b7e5c508c40756242f55991a354cd41"
    const admin = "0xc7061dD515B602F86733Fa0a0dBb6d6E6B34aED4";
    // const yearnLp1 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xad17a225074191d5c8a37b50fda1ae278a2ee6a2");
    const maiUSDCBeefy = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x01D9cfB8a9D43013a1FdC925640412D8d2D900F0");
    const hopUSDCBeefy = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE2f035f59De6a952FF699b4EDD0f99c466f25fEc");
    const weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
    const exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
    const ALLUO_PROXY_DEPLOYER = "0xD8389Af65F99D1EF67516189b5ff25c33C5e76b3";

    let signers = await ethers.getSigners();
    console.log("The current deployer address is", signers[0].address);
    if (signers[0].address != ALLUO_PROXY_DEPLOYER) {
        console.log("Failed");
        return;
    }
    const ETHOmnivault = (await upgrades.deployProxy(omniVaultFactory, [
        exchange.address,
        weth.address,
        [mooLp1.address],
        [100],
        [lp1BoostAddress],
        admin,
        1000,
        60 * 60 * 8
    ], {
        initializer: "initialize",
    })) as AlluoOmnivault;


    const USDOmnivault = (await upgrades.deployProxy(omniVaultFactory, [
        exchange.address,
        usdc.address,
        [maiUSDCBeefy.address, hopUSDCBeefy.address],
        [50, 50],
        [ethers.constants.AddressZero, ethers.constants.AddressZero],
        admin,
        1000,
        60 * 60 * 8
    ], {
        initializer: "initialize",
    })) as AlluoOmnivault;

    console.log("Deployed ETH Omnivault at: ", ETHOmnivault.address);
    console.log("Deployed USD Omnivault at: ", USDOmnivault.address);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet