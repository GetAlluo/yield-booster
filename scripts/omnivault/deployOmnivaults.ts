import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";
import { run } from "hardhat";
import { reset } from "@nomicfoundation/hardhat-network-helpers"
async function main() {
    // await reset(process.env.OPTIMISM_URL);
    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
    const weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
    const exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
    const ALLUO_PROXY_DEPLOYER = "0xD8389Af65F99D1EF67516189b5ff25c33C5e76b3";
    const admin = "0xc7061dD515B602F86733Fa0a0dBb6d6E6B34aED4"
    let signers = await ethers.getSigners();
    console.log("The current deployer address is", signers[0].address);
    if (signers[0].address != ALLUO_PROXY_DEPLOYER) {
        console.log("Failed");
        return;
    }
    type deployParameters = { name: string, params: [string, string, string[], number[], string[], string, number, number] };

    const deployingParameters: deployParameters[] = [];

    let beefyUSDTopVault: deployParameters = { name: "beefyTopUsd", params: [exchange.address, usdc.address, ["0x60bBDf88bd2DbAA645D6CF8Ae67d2F4aDA2658F1"], [100], [ethers.constants.AddressZero], admin, 1000, 60 * 60 * 8] }
    let beefyUsdTop3Vault: deployParameters = { name: "beefyUsdTop3", params: [exchange.address, usdc.address, ["0x60bBDf88bd2DbAA645D6CF8Ae67d2F4aDA2658F1", "0x5990002594b13e174885ba4D4Ec15B8a8A4485bb", "0xa9913D2DA71768CD13eA75B05D9E91A3120E2f08"], [33, 33, 34], [ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero], admin, 1000, 60 * 60 * 8] }
    let beefyTopETHVault: deployParameters = { name: "beefyTopEth", params: [exchange.address, weth.address, ["0x1b620BE62788e940b4c4ae6Df933c50981AcAB80"], [100], [ethers.constants.AddressZero], admin, 1000, 60 * 60 * 8] }
    let beefyETHTop3Vault: deployParameters = { name: "beefyEthTop3", params: [exchange.address, weth.address, ["0x1b620BE62788e940b4c4ae6Df933c50981AcAB80", "0xf46346DE9c2E5e652FcC37695D3dEC3D672C45BA", "0xFb806C7D711f6F48b23F682cB73eE2e020a84425"], [33, 33, 34], [ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero], admin, 1000, 60 * 60 * 8] }

    let yearnUSDTopVault: deployParameters = { name: "yearnTopUsd", params: [exchange.address, usdc.address, ["0xaD17A225074191d5c8a37B50FdA1AE278a2EE6A2"], [100], ["0xb2c04c55979b6ca7eb10e666933de5ed84e6876b"], admin, 1000, 60 * 60 * 8] }
    let yearnUsdTop3Vault: deployParameters = { name: "yearnUsdTop3", params: [exchange.address, usdc.address, ["0xaD17A225074191d5c8a37B50FdA1AE278a2EE6A2", "0xFaee21D0f0Af88EE72BB6d68E54a90E6EC2616de", "0x65343F414FFD6c97b0f6add33d16F6845Ac22BAc"], [33, 33, 34], ["0xb2c04c55979b6ca7eb10e666933de5ed84e6876b", "0xf66932f225ca48856b7f97b6f060f4c0d244af8e", "0xf8126ef025651e1b313a6893fcf4034f4f4bd2aa"], admin, 1000, 60 * 60 * 8] }
    let yearnTopETHVault: deployParameters = { name: "yearnTopEth", params: [exchange.address, weth.address, ["0x5B977577Eb8a480f63e11FC615D6753adB8652Ae"], [100], ["0xe35fec3895dcecc7d2a91e8ae4ff3c0d43ebffe0"], admin, 1000, 60 * 60 * 8] }
    let yearnETHTop3Vault: deployParameters = { name: "yearnEthTop3", params: [exchange.address, weth.address, ["0x5B977577Eb8a480f63e11FC615D6753adB8652Ae"], [100], ["0xe35fec3895dcecc7d2a91e8ae4ff3c0d43ebffe0"], admin, 1000, 60 * 60 * 8] }


    // Append all the vaults to the array
    deployingParameters.push(beefyUSDTopVault);
    deployingParameters.push(beefyUsdTop3Vault);
    deployingParameters.push(beefyTopETHVault);
    deployingParameters.push(beefyETHTop3Vault);
    deployingParameters.push(yearnUSDTopVault);
    deployingParameters.push(yearnUsdTop3Vault);
    deployingParameters.push(yearnTopETHVault);
    deployingParameters.push(yearnETHTop3Vault);


    // Deploy all the vaults
    let deployedAddresses: string[] = [];
    for (let i = 0; i < deployingParameters.length; i++) {
        let name = deployingParameters[i].name;
        let params = deployingParameters[i].params;
        console.log("Deploying " + name + " with params: " + params);
        const vault = (await upgrades.deployProxy(omniVaultFactory, params, { initializer: "initialize", })) as AlluoOmnivault;
        console.log("Deployed " + name + " at " + vault.address);
        await vault.deployed();
        deployedAddresses.push(vault.address);
        console.log("\n")
    }


    // Simulate depositing into each vault using usdc, but first i need to get some usdc through signer0
    // await exchange.exchange(ethers.constants.AddressZero, usdc.address, ethers.utils.parseEther("10"), 0, { value: ethers.utils.parseEther("10") });
    // for (let i = 0; i < deployedAddresses.length; i++) {
    //     let vault = await ethers.getContractAt("AlluoOmnivault", deployedAddresses[i]);
    //     await usdc.approve(vault.address, ethers.utils.parseEther("1000000000000"));
    //     await vault.deposit(usdc.address, ethers.utils.parseUnits("100", 6));
    //     console.log("The vault should have 0 usdc", (await usdc.balanceOf(vault.address)).toString());
    //     console.log("The vualt should have 0 eth", (await weth.balanceOf(vault.address)).toString());
    //     let activeStrategies = await vault.getActiveUnderlyingVaults();
    //     for (let j = 0; j < activeStrategies.length; j++) {
    //         let vaultToken = await ethers.getContractAt("IERC20MetadataUpgradeable", activeStrategies[j]);
    //         console.log("Vault token balance should be zero for yearn boosted", (await vaultToken.balanceOf(vault.address)).toString());
    //         console.log("The vault's underlying balance should be greater though", (await vault.getVaultBalanceOf(activeStrategies[j])).toString());
    //     }
    //     // Now withdraw and the vault should have nothing
    //     await vault.withdraw(usdc.address, 100);
    //     console.log("The vault should have 0 usdc", (await usdc.balanceOf(vault.address)).toString());
    //     console.log("The vualt should have 0 eth", (await weth.balanceOf(vault.address)).toString());
    //     for (let j = 0; j < activeStrategies.length; j++) {
    //         console.log("The vault's underlying balance should be 0", (await vault.getVaultBalanceOf(activeStrategies[j])).toString());
    //     }
    //     console.log("Finished", "\n")

    // }
    for (let i = 0; i < deployedAddresses.length; i++) {
        await verify(deployedAddresses[i]);
    }

}

const verify = async (contractAddress: any) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
        });
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
};


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet