import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICurvePool, ICvxBooster, IERC20MetadataUpgradeable, IExchange, IWrappedEther } from "../../typechain";


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

describe("StEth Alluo Vault Upgradeable Tests", function () {
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable, ldo: IERC20MetadataUpgradeable, stEth: IERC20MetadataUpgradeable;
    let cvxBooster: ICvxBooster;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault: AlluoVaultUpgradeable;
    let rewardToken: IERC20MetadataUpgradeable;
    let stEthEth: IERC20MetadataUpgradeable;
    let alluoPool: IAlluoPool;

    before(async function () {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 15506073,
                },
            },],
        });

    })

    before(async () => {
        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoVaultUpgradeable.sol has been uncommented to ensure tests are functioning correctly |||", '\n')

    });

    beforeEach(async () => {

        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 15717570,
                },
            },],
        });
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        ldo = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32");

        stEth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        stEthEth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x06325440D014e39736583c165C2963BA99fAf14E");
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");

        const value = parseEther("2000.0");
        const wrappedEther = await ethers.getContractAt("contracts/boost/interfaces/IWrappedEther.sol:IWrappedEther", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") as IWrappedEther;
        await wrappedEther.deposit({ value: "100" })
        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, usdt.address, value, 0, { value: value }
        )

        await exchange.exchange(
            ZERO_ADDR, usdc.address, value, 0, { value: value }
        )


        const stEthEthPool = await ethers.getContractAt("ICurvePool", "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022")
        await stEthEthPool.add_liquidity([parseEther("1"), 0], 0, { value: parseEther("1") });
        let gnosis = "0x6b140e772aCC4D5E0d5Eac3813D586aa6DB8Fbf7";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")

        AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
            "StEth-Eth Vault",
            "abStETH",
            stEthEth.address,
            rewardToken.address,
            rewardToken.address,
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
            [crv.address, cvx.address, ldo.address],
            ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", stEth.address],
            25,
            stEthEthPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoVaultUpgradeable;

        let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");
        alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
            rewardToken.address,
            gnosis,
            [crv.address, cvx.address],
            [AlluoVault.address],
            "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
            64, //Pool number convex
            cvx.address
        ]) as AlluoVaultPool
        await AlluoVault.setPool(alluoPool.address);

        await AlluoVault.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
    });

    afterEach(async () => {
        expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());
    })
    it("Deposit some LP", async function () {
        const lpBalance = await stEthEth.balanceOf(signers[0].address);
        console.log("Balance before of stEth-Eth Lp", lpBalance)
        await stEthEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        console.log("Shares after", await AlluoVault.balanceOf(signers[0].address));
        expect(Number(await AlluoVault.balanceOf(signers[0].address))).greaterThan(0);
        expect(Number(lpBalance)).equal(Number(await AlluoVault.balanceOf(signers[0].address)));
    })

    it("Deposit some LP and wait for rewards to accumulate", async function () {
        const lpBalance = await stEthEth.balanceOf(signers[0].address);
        console.log("Balance before of stEth-Eth Lp", lpBalance)
        await stEthEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        const ldoAccumulated = await ldo.balanceOf(AlluoVault.address);

        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(ldoAccumulated)

        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
        expect(Number(ldoAccumulated)).greaterThan(0)

    })
    it("Wait for rewards then loop rewards.", async function () {
        const lpBalance = await stEthEth.balanceOf(signers[0].address);
        console.log("Balance before of stEth-Eth Lp", lpBalance)
        await stEthEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        await alluoPool.farm();
        console.log("crv-ETH staked", await alluoPool.fundsLocked());
        expect(Number(await alluoPool.fundsLocked())).greaterThan(0);
    })

    it("After looping rewards, expect fundsLocked to increase.", async function () {
        const lpBalance = await stEthEth.balanceOf(signers[0].address);
        console.log("Balance before of stEth-Eth Lp", lpBalance)
        await stEthEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();
        const initialRewards = await alluoPool.fundsLocked();


        await skipDays(0.01);
        await alluoPool.claimRewardsFromPool();


        const crvAccumulated = await crv.balanceOf(alluoPool.address);
        const cvxAccumulated = await cvx.balanceOf(alluoPool.address);
        const ldoAccumulated = await ldo.balanceOf(AlluoVault.address);

        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(ldoAccumulated)


        await alluoPool.farm();
        const compoundedRewards = await alluoPool.fundsLocked();

        console.log("crv-ETH staked after", await alluoPool.fundsLocked());
        expect(Number(compoundedRewards)).greaterThan(Number(initialRewards));
    })

    it("Deposit some Lp for vault tokens and then burn them for the same LPs back.", async function () {
        const lpBalance = await stEthEth.balanceOf(signers[0].address);
        await stEthEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();

        await AlluoVault.withdraw(lpBalance, signers[0].address, signers[0].address);
        await AlluoVault.claimRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).equal(0)
        expect(await stEthEth.balanceOf(signers[0].address)).equal(lpBalance)
        console.log("Rewardsin LP", Number(await rewardToken.balanceOf(signers[0].address)));
        expect(Number(await rewardToken.balanceOf(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault.totalAssets())).equal(0)
        expect(Number(await AlluoVault.totalSupply())).equal(0)
    })

    it("Deposit frax to enter pool.", async function () {
        const fraxBalance = parseEther("100");
        await frax.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(fraxBalance, frax.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        const ldoAccumulated = await ldo.balanceOf(AlluoVault.address);

        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(ldoAccumulated)

        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
        expect(Number(ldoAccumulated)).greaterThan(0)
    })

    it("Deposit StEth to enter pool.", async function () {
        const stEth = parseUnits("100", 6);
        await usdc.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(stEth, usdc.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        const ldoAccumulated = await ldo.balanceOf(AlluoVault.address);

        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(ldoAccumulated)

        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
        expect(Number(ldoAccumulated)).greaterThan(0)
    })

    it("Deposit usdt to enter pool (non pool token).", async function () {

        const usdtBalance = parseUnits("100", 6);
        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        const ldoAccumulated = await ldo.balanceOf(AlluoVault.address);

        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        console.log(ldoAccumulated)

        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
        expect(Number(ldoAccumulated)).greaterThan(0)
    })

    it("Deposit usdc to enter pool and exit again in USDC", async function () {
        // const fraxBalance = await frax.balanceOf(signers[0].address);
        // console.log("Balance before of Frax balance", fraxBalance)
        const usdcBalance = parseUnits("100", 6);
        await usdc.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdc.address)

    })

    it("Deposit usdt to enter pool (non pool token) and exit again in a non pool token.", async function () {
        const usdtBalance = parseUnits("100", 6);
        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdt.address)
    })

    it("Multiple deposits and withdrawals should return correct LP amounts", async function () {
        let signerBalancesBefore = []
        for (let i = 1; i < 6; i++) {
            const wrappedEther = await ethers.getContractAt("contracts/boost/interfaces/IWrappedEther.sol:IWrappedEther", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") as IWrappedEther;
            await wrappedEther.connect(signers[i]).deposit({ value: "1" })
            const stEthEthPool = await ethers.getContractAt("ICurvePool", "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022")
            await stEthEthPool.connect(signers[i]).add_liquidity([parseEther("1"), 0], 0, { value: parseEther("1") });

            let lpBalance = await stEthEth.balanceOf(signers[i].address)
            await stEthEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
            signerBalancesBefore.push(await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        for (let i = 1; i < 6; i++) {
            let signerBalance = await AlluoVault.balanceOf(signers[i].address)
            await AlluoVault.connect(signers[i]).withdraw(signerBalance, signers[i].address, signers[i].address);
            expect(Number(await AlluoVault.balanceOf(signers[i].address))).equal(0);
        }

        for (let i = 0; i < 5; i++) {
            expect(Number(signerBalancesBefore[i])).equal(Number(await stEthEth.balanceOf(signers[i + 1].address)))
        }
    })
    it("Multiple deposits and withdrawals should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            const wrappedEther = await ethers.getContractAt("contracts/boost/interfaces/IWrappedEther.sol:IWrappedEther", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") as IWrappedEther;
            await wrappedEther.connect(signers[i]).deposit({ value: "1" })
            const stEthEthPool = await ethers.getContractAt("ICurvePool", "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022")
            await stEthEthPool.connect(signers[i]).add_liquidity([parseEther("1"), 0], 0, { value: parseEther("1") });

            let lpBalance = parseEther("0.5")
            await stEthEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }

        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();
        await skipDays(0.01);
        await AlluoVault.connect(signers[1]).claimRewards();
        let expectBalance = await rewardToken.balanceOf(signers[1].address)

        for (let i = 2; i < 6; i++) {
            await AlluoVault.connect(signers[i]).claimRewards();
            // Small dust
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(5)).equal(Number(expectBalance).toPrecision(5))
            console.log(`Reward tokens for signer ${i}: ${await rewardToken.balanceOf(signers[i].address)}`)
        }
    })

    it("Multiple deposits and withdrawals in nonLP tokens should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, frax.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            const fraxBalance = parseEther("100");
            await frax.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).depositWithoutLP(fraxBalance, frax.address);

            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();
        await skipDays(0.01);
        await AlluoVault.connect(signers[1]).claimRewards();
        await AlluoVault.connect(signers[1]).withdrawToNonLp(await AlluoVault.balanceOf(signers[1].address), signers[1].address, signers[1].address, frax.address);
        expect(await AlluoVault.balanceOf(signers[1].address)).equal(0);

        let expectBalance = await rewardToken.balanceOf(signers[1].address)
        for (let i = 2; i < 6; i++) {
            await AlluoVault.connect(signers[i]).claimRewards();
            await AlluoVault.connect(signers[i]).withdrawToNonLp(await AlluoVault.balanceOf(signers[i].address), signers[i].address, signers[i].address, frax.address);
            // Small dust
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(2)).equal(Number(expectBalance).toPrecision(2))
            expect(await AlluoVault.balanceOf(signers[i].address)).equal(0);
            console.log(`Reward tokens for signer ${i}: ${await rewardToken.balanceOf(signers[i].address)}`)
        }
        expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());

    })



    it("After some loops, the multisig should be able to claim fees accumulated.", async function () {
        await AlluoVault.setAdminFee(100)

        let gnosis = "0x6b140e772aCC4D5E0d5Eac3813D586aa6DB8Fbf7";

        for (let i = 1; i < 6; i++) {
            const wrappedEther = await ethers.getContractAt("contracts/boost/interfaces/IWrappedEther.sol:IWrappedEther", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") as IWrappedEther;
            await wrappedEther.connect(signers[i]).deposit({ value: "1" })
            const stEthEthPool = await ethers.getContractAt("ICurvePool", "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022")
            await stEthEthPool.connect(signers[i]).add_liquidity([parseEther("1"), 0], 0, { value: parseEther("1") });

            let lpBalance = await stEthEth.balanceOf(signers[i].address)
            await stEthEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();
        await skipDays(0.01);

        expect(Number(await AlluoVault.earned(gnosis))).greaterThan(0);

    })
})