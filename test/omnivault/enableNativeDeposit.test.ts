import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
describe("Add support for native ETH deposits", function () {
    let omnivault1: AlluoOmnivault, omnivault2: AlluoOmnivault, omnivault3: AlluoOmnivault, omnivault4: AlluoOmnivault, omnivault5: AlluoOmnivault, omnivault6: AlluoOmnivault, omnivault7: AlluoOmnivault, omnivault8: AlluoOmnivault;
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable, ldo: IERC20MetadataUpgradeable, yvOP
    let mooLp1: IERC20MetadataUpgradeable, yearnLp1: IERC20MetadataUpgradeable, mooLp2: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let admin: SignerWithAddress;

    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.OPTIMISM_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 101048486,
                },
            },],
        });
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
        mooLp1 = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x0892a178c363b4739e5Ac89E9155B9c30214C0c0');
        yearnLp1 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xad17a225074191d5c8a37b50fda1ae278a2ee6a2");
        mooLp2 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE2f035f59De6a952FF699b4EDD0f99c466f25fEc");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
        ldo = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xfdb794692724153d1488ccdbe0c56c252596735f")
        yvOP = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7D2382b1f8Af621229d33464340541Db362B4907")
        exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
        admin = await ethers.getImpersonatedSigner("0xc7061dd515b602f86733fa0a0dbb6d6e6b34aed4");
        omnivault1 = await ethers.getContractAt("AlluoOmnivault", "0xAf332f4d7A82854cB4B6345C4c133eC60c4eAd87");
        omnivault2 = await ethers.getContractAt("AlluoOmnivault", "0x75862d2fEdb1c6a9123F3b5d5E36D614570B404d");
        omnivault3 = await ethers.getContractAt("AlluoOmnivault", "0x306Df6b5D50abeD3f7bCbe7399C4b8e6BD55cB81");
        omnivault4 = await ethers.getContractAt("AlluoOmnivault", "0x2682c8057426FE5c462237eb3bfcfEDFb9539004");
        omnivault5 = await ethers.getContractAt("AlluoOmnivault", "0x2EC847395B6247Ab72b7B37432989f4547A0e947");
        omnivault6 = await ethers.getContractAt("AlluoOmnivault", "0xA430432eEf5C062D34e4078540b91C2ec7DBe0c9");
        omnivault7 = await ethers.getContractAt("AlluoOmnivault", "0x4eC3177F5c2500AAABE56DDbD8907d41d17Fc2E9");
        omnivault8 = await ethers.getContractAt("AlluoOmnivault", "0xDd7ebC54b851E629E61bc49DFcAed41C13fc67Da");
        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })

        await signers[0].sendTransaction({ to: admin.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }
    });

    it("Should upgrade the current contract, the deposits and withdraws should work with native eth", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();
        // Change upgrade status and upgrade the existing omnivault
        let omnivaults = [omnivault1, omnivault2, omnivault3, omnivault4, omnivault5, omnivault6, omnivault7, omnivault8]
        for (let i = 0; i < omnivaults.length; i++) {
            await omnivaults[i].connect(admin).changeUpgradeStatus(true);
            await omnivaults[i].connect(admin).grantRole(await omnivaults[i].UPGRADER_ROLE(), admin.address)
            await omnivaults[i].connect(admin).upgradeTo(newProxy.address);
        }

        // Deposit and withdraw with native eth in each vault
        for (let i = 0; i < omnivaults.length; i++) {
            let signerEthBalanceBefore = await signers[i].getBalance();
            await omnivaults[i].connect(signers[0]).deposit(ethers.constants.AddressZero, ethers.utils.parseEther("10"), { value: ethers.utils.parseEther("10") });
            await omnivaults[i].connect(signers[0]).withdraw(ethers.constants.AddressZero, 100);
            let signerEthBalanceAfter = await signers[i].getBalance();
            expect(signerEthBalanceAfter).to.be.closeTo(signerEthBalanceBefore, ethers.utils.parseEther("0.1"))
            console.log("Signer eth balance before: ", ethers.utils.formatEther(signerEthBalanceBefore))
            console.log("Signer eth balance after: ", ethers.utils.formatEther(signerEthBalanceAfter))
        }
    })
    it("Should upgrade the current contract, and revert if the msg.value is not equal to the amount", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();
        // Change upgrade status and upgrade the existing omnivault
        let omnivaults = [omnivault1, omnivault2, omnivault3, omnivault4, omnivault5, omnivault6, omnivault7, omnivault8]
        for (let i = 0; i < omnivaults.length; i++) {
            await omnivaults[i].connect(admin).changeUpgradeStatus(true);
            await omnivaults[i].connect(admin).grantRole(await omnivaults[i].UPGRADER_ROLE(), admin.address)
            await omnivaults[i].connect(admin).upgradeTo(newProxy.address);
        }

        // Deposit and withdraw with native eth in each vault
        for (let i = 0; i < omnivaults.length; i++) {
            await expect(omnivaults[i].connect(signers[0]).deposit(ethers.constants.AddressZero, ethers.utils.parseEther("10"), { value: ethers.utils.parseEther("11") })).to.be.revertedWith("!SAME")
            await expect(omnivaults[i].connect(signers[0]).deposit(ethers.constants.AddressZero, ethers.utils.parseEther("10"), { value: ethers.utils.parseEther("9") })).to.be.revertedWith("!SAME")

        }
    })
})