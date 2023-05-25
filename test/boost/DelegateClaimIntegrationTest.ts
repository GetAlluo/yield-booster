import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICvxBooster, IERC20MetadataUpgradeable, IExchange, IFraxFarmERC20, AlluoLockedVault, AlluoRewardsDistributor } from "../../typechain";


async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
    await ethers.provider.send(
        'hardhat_impersonateAccount',
        [address]
    );

    return await ethers.getSigner(address);
}

async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

describe("Alluo Claim Rewards Tests", function () {
    let signers: SignerWithAddress[];
    let gnosis: SignerWithAddress;
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let cvxBooster: ICvxBooster;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault1: AlluoVaultUpgradeable;
    let AlluoVault2: AlluoVaultUpgradeable;
    let AlluoVault3: AlluoVaultUpgradeable;
    let AlluoVault4: AlluoVaultUpgradeable;
    let AlluoVault5: AlluoVaultUpgradeable;
    let rewardsDistributor: AlluoRewardsDistributor;
    let fraxUSDC: IERC20MetadataUpgradeable;

    let ethFrxEthLp: IERC20MetadataUpgradeable;
    let rewardToken: IERC20MetadataUpgradeable;
    let cvxEth: IERC20MetadataUpgradeable;
    let alluoPool1: AlluoVaultPool;
    let ethFrxEthPool: IFraxFarmERC20;
    let fxs: IERC20MetadataUpgradeable;


    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 16677150,
                },
            },],
        });

        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        cvxEth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        fraxUSDC = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
        ethFrxEthLp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xf43211935C781D5ca1a41d2041F397B8A7366C7A");
        ethFrxEthPool = await ethers.getContractAt("IFraxFarmERC20", "0xa537d64881b84faffb9Ae43c951EEbF368b71cdA");
        fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0");

        let value = parseEther("2000.0");

        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, usdt.address, value, 0, { value: value }
        )

        await exchange.exchange(
            ZERO_ADDR, usdc.address, value, 0, { value: value }
        )

        const fraxUSDCPool = await ethers.getContractAt("ICurvePool", "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2")
        await frax.approve(fraxUSDCPool.address, ethers.constants.MaxUint256)
        await fraxUSDCPool.add_liquidity([parseEther("1000"), 0], 0);

        const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")
        value = parseEther("100.0");

        await exchange.exchange(
            ZERO_ADDR, cvxEth.address, value, 0, { value: value }
        )
        gnosis = await getImpersonatedSigner("0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3");

        AlluoVault1 = await ethers.getContractAt("AlluoVaultUpgradeable", "0x910c98B3EAc2B4c3f6FdB81882bfd0161e507567")
        AlluoVault2 = await ethers.getContractAt("AlluoVaultUpgradeable", "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b")
        AlluoVault3 = await ethers.getContractAt("AlluoVaultUpgradeable", "0x1EE566Fd6918101C578a1d2365d632ED39BEd740")
        AlluoVault4 = await ethers.getContractAt("AlluoVaultUpgradeable", "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271")
        AlluoVault5 = await ethers.getContractAt("AlluoVaultUpgradeable", "0x7417e7d4369090FC49C43789116efC34c52b2D98")

        // Change upgrade status on all vaults to true
        await AlluoVault1.connect(gnosis).changeUpgradeStatus(true);
        await AlluoVault2.connect(gnosis).changeUpgradeStatus(true);
        await AlluoVault3.connect(gnosis).changeUpgradeStatus(true);
        await AlluoVault4.connect(gnosis).changeUpgradeStatus(true);
        await AlluoVault5.connect(gnosis).changeUpgradeStatus(true);

        let newImplementation = await ethers.getContractFactory("AlluoVaultUpgradeable");
        let newImplementationDeployed = await newImplementation.deploy()

        await AlluoVault1.connect(gnosis).upgradeTo(newImplementationDeployed.address);
        await AlluoVault2.connect(gnosis).upgradeTo(newImplementationDeployed.address);
        await AlluoVault3.connect(gnosis).upgradeTo(newImplementationDeployed.address);
        await AlluoVault4.connect(gnosis).upgradeTo(newImplementationDeployed.address);
        await AlluoVault5.connect(gnosis).upgradeTo(newImplementationDeployed.address);


        alluoPool1 = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714")
        let secondImplementation = await ethers.getContractFactory("AlluoVaultPool");
        let secondImplementationDeployed = await secondImplementation.deploy()
        await alluoPool1.connect(gnosis).changeUpgradeStatus(true);
        await alluoPool1.connect(gnosis).upgradeTo(secondImplementationDeployed.address);


        let Rewards = await ethers.getContractFactory("AlluoRewardsDistributor");
        rewardsDistributor = await upgrades.deployProxy(Rewards, [
            rewardToken.address,
            [alluoPool1.address],
            gnosis.address
        ]) as AlluoRewardsDistributor;


        await alluoPool1.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault1.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault2.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault3.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault4.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault5.connect(gnosis).grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);

        await rewardsDistributor.editVaults(true, alluoPool1.address, [AlluoVault1.address, AlluoVault2.address, AlluoVault3.address, AlluoVault4.address, AlluoVault5.address]);

    });

    it("Should distribute rewards for existing user", async function () {
        let existingUser = await getImpersonatedSigner("0xeC3E9c6769FF576Da3889071c639A0E488815926")
        await signers[0].sendTransaction({
            to: existingUser.address,
            value: parseEther("1")

        });
        console.log("Current user's reward cvxETH balances");
        console.log(await AlluoVault1.rewards(existingUser.address));
        console.log(await AlluoVault2.rewards(existingUser.address));
        console.log(await AlluoVault3.rewards(existingUser.address));
        console.log(await AlluoVault4.rewards(existingUser.address));
        console.log(await AlluoVault5.rewards(existingUser.address));
        let before = await usdc.balanceOf(existingUser.address)
        console.log("Total usdc before", before);
        console.log("Now claim using rewards distributor");
        await rewardsDistributor.connect(existingUser).claimAllFromPool(usdc.address, alluoPool1.address);

        console.log("Current user's reward cvxETH balances after");
        console.log(await AlluoVault1.rewards(existingUser.address));
        console.log(await AlluoVault2.rewards(existingUser.address));
        console.log(await AlluoVault3.rewards(existingUser.address));
        console.log(await AlluoVault4.rewards(existingUser.address));
        console.log(await AlluoVault5.rewards(existingUser.address));

        expect(await AlluoVault1.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault2.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault3.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault4.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault5.rewards(existingUser.address)).to.be.equal(0);
        let after = await usdc.balanceOf(existingUser.address)
        console.log("Total usdc after", after);
        expect(after).to.be.gt(before);
    });
    it("Claim rewards for same user, but separately and check gas usage", async function () {
        let existingUser = await getImpersonatedSigner("0xeC3E9c6769FF576Da3889071c639A0E488815926")
        await signers[0].sendTransaction({
            to: existingUser.address,
            value: parseEther("1")

        });
        console.log("Current user's reward cvxETH balances");
        console.log(await AlluoVault1.rewards(existingUser.address));
        console.log(await AlluoVault2.rewards(existingUser.address));
        console.log(await AlluoVault3.rewards(existingUser.address));
        console.log(await AlluoVault4.rewards(existingUser.address));
        console.log(await AlluoVault5.rewards(existingUser.address));
        let before = await usdc.balanceOf(existingUser.address)
        console.log("Total usdc before", before);
        console.log("Now claim using rewards distributor");
        // await AlluoVault1.connect(existingUser).claimRewardsInNonLp(usdc.address)
        await AlluoVault2.connect(existingUser).claimRewardsInNonLp(usdc.address)
        // await AlluoVault3.connect(existingUser).claimRewardsInNonLp(usdc.address)
        await AlluoVault4.connect(existingUser).claimRewardsInNonLp(usdc.address)
        await AlluoVault5.connect(existingUser).claimRewardsInNonLp(usdc.address)

        console.log("Current user's reward cvxETH balances after");
        console.log(await AlluoVault1.rewards(existingUser.address));
        console.log(await AlluoVault2.rewards(existingUser.address));
        console.log(await AlluoVault3.rewards(existingUser.address));
        console.log(await AlluoVault4.rewards(existingUser.address));
        console.log(await AlluoVault5.rewards(existingUser.address));

        expect(await AlluoVault1.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault2.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault3.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault4.rewards(existingUser.address)).to.be.equal(0);
        expect(await AlluoVault5.rewards(existingUser.address)).to.be.equal(0);
        let after = await usdc.balanceOf(existingUser.address)
        console.log("Total usdc after", after);
        expect(after).to.be.gt(before);
    })
})
