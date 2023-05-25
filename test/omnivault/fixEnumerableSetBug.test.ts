import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
describe("Fix enumerable set bug", function () {
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
                    blockNumber: 94390900,
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
        omnivault = await ethers.getContractAt("AlluoOmnivault", "0xc7dbb63dceb6b20128fab55797fd7aa832694867");

        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })

        await signers[0].sendTransaction({ to: admin.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }
    });

    it("Should upgrade the current contract, remove the bug and then check that deposits and withdraws work as usual.", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();

        // Change upgrade status and upgrade the existing omnivault
        await omnivault.connect(admin).changeUpgradeStatus(true);
        await omnivault.connect(admin).upgradeTo(newProxy.address);

        // Remove the bug and then deposit and withdraw
        await omnivault.connect(admin).removeActiveUnderlyingVault("0xe2f035f59de6a952ff699b4edd0f99c466f25fec");

        let activeVaults = await omnivault.getActiveUnderlyingVaults();
        expect(activeVaults.length).to.equal(2);
        expect(activeVaults[0]).to.equal("0xe282AD2480fFD8e34454C56c4360E5ba3240a429");
        expect(activeVaults[1]).to.equal("0xa9913D2DA71768CD13eA75B05D9E91A3120E2f08");

        // Deposit and withdraw
        await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100000", 6));
        await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("10000", 6),);

        // expect that the balance of the redundant token is zero
        let redundantToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xe2f035f59de6a952ff699b4edd0f99c466f25fec");
        let balance = await redundantToken.balanceOf(omnivault.address);
        expect(balance).to.equal(0);

        // Withdraw and expect a decently close balance to 10000 usdc
        let returnAmount = await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100);
        expect(returnAmount).to.be.closeTo(ethers.utils.parseUnits("10000", 6), ethers.utils.parseUnits("50", 6));
    })

    it("Should upgrade the current contract, remove the bug and then check that rebalancing has indeed removed the bug", async () => {
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();

        // Change upgrade status and upgrade the existing omnivault
        await omnivault.connect(admin).changeUpgradeStatus(true);
        await omnivault.connect(admin).upgradeTo(newProxy.address);

        // Remove the bug and then deposit and withdraw
        await omnivault.connect(admin).removeActiveUnderlyingVault("0xe2f035f59de6a952ff699b4edd0f99c466f25fec");

        await omnivault.connect(admin).redistribute([mooLp1.address], [100], [ethers.constants.AddressZero]);

        let activeVaults = await omnivault.getActiveUnderlyingVaults();
        expect(activeVaults.length).to.equal(1);
        expect(activeVaults[0]).to.equal(mooLp1.address);
    })

})