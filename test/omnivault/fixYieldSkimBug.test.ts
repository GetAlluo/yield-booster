import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
describe("Fix skim yield bug", function () {
    let omnivault: AlluoOmnivault;
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
                    blockNumber: 99387392,
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
        omnivault = await ethers.getContractAt("AlluoOmnivault", "0x75862d2fedb1c6a9123f3b5d5e36d614570b404d");

        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })

        await signers[0].sendTransaction({ to: admin.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }
    });

    it("Should upgrade the current contract, remove the bug and then check that deposits work as usual.", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();
        // Change upgrade status and upgrade the existing omnivault
        await omnivault.connect(admin).changeUpgradeStatus(true);
        await omnivault.connect(admin).grantRole(await omnivault.UPGRADER_ROLE(), admin.address)
        await omnivault.connect(admin).upgradeTo(newProxy.address);


        // Deposit and withdraw
        await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100000", 6));
        await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("10000", 6),);

    })

    it("Should upgrade the current contract, remove the bug and then check that deposits work as usual.", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );


        omnivault = await ethers.getContractAt("AlluoOmnivault", "0x2682c8057426FE5c462237eb3bfcfEDFb9539004")


        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();
        // Change upgrade status and upgrade the existing omnivault
        await omnivault.connect(admin).changeUpgradeStatus(true);
        await omnivault.connect(admin).grantRole(await omnivault.UPGRADER_ROLE(), admin.address)
        await omnivault.connect(admin).upgradeTo(newProxy.address);


        // Deposit and withdraw
        await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100000", 6));
        await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("10000", 6),);

    })
})