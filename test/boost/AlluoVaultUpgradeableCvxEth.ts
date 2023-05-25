import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICurvePool, ICvxBooster, IERC20MetadataUpgradeable, IExchange } from "../../typechain";


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

describe("Cvx Eth Alluo Vault Upgradeable Tests", function () {
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let cvxBooster: ICvxBooster;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault: AlluoVaultUpgradeable;
    let rewardToken: IERC20MetadataUpgradeable;
    let cvxEth: IERC20MetadataUpgradeable;
    let alluoPool: IAlluoPool;

    before(async function () {
        //We are forking Polygon mainnet, please set Alchemy key in .env
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 15426472,
                },
            },],
        });

    })

    before(async () => {

        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoVaultUpgradeable.sol has been uncommented to ensure tests are functioning correctly |||", '\n')
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

        const value = parseEther("2000.0");

        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, usdt.address, value, 0, { value: value }
        )

        await exchange.exchange(
            ZERO_ADDR, usdc.address, value, 0, { value: value }
        )

        // Set up new route for exchange:
        const CurveCvxEthAdapter = await ethers.getContractFactory("CurveCvxEthAdapter");
        const deployedAdapter = await CurveCvxEthAdapter.deploy();
        const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")

        let gnosis = await getImpersonatedSigner("0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3")
        await signers[0].sendTransaction({ to: gnosis.address, value: parseEther("100") })

        await exchange.connect(gnosis).registerAdapters([deployedAdapter.address], [11])
        let cvxEthEdge = { swapProtocol: 11, pool: cvxEthPool.address, fromCoin: cvxEth.address, toCoin: weth.address };
        await (await exchange.connect(gnosis).createMinorCoinEdge([cvxEthEdge])).wait();
    });

    beforeEach(async () => {
        const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")
        const value = parseEther("100.0");

        await exchange.exchange(
            ZERO_ADDR, cvxEth.address, value, 0, { value: value }
        )
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
        AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
            "Cvx-Eth Vault",
            "abCvxEth",
            cvxEth.address,
            rewardToken.address,
            rewardToken.address,
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
            [crv.address, cvx.address],
            [weth.address, cvx.address],
            64,
            cvxEthPool.address
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
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        console.log("Balance before of Cvx-ETH Lp", lpBalance)
        await cvxEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        console.log("Shares after", await AlluoVault.balanceOf(signers[0].address));
        expect(Number(await AlluoVault.balanceOf(signers[0].address))).greaterThan(0);
        expect(Number(lpBalance)).equal(Number(await AlluoVault.balanceOf(signers[0].address)));
    })

    it("Deposit some LP and wait for rewards to accumulate", async function () {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        console.log("Balance before of Cvx-ETH Lp", lpBalance)
        await cvxEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        let beforeAccrued = await AlluoVault.shareholderAccruedRewards(signers[0].address);
        console.log("Shareholder accumulated before", beforeAccrued);

        // Now get some crv and cvx and send directly to the pool. Then check the view function. This is checking the edge case where there are rewards sitting in the vault as erc20s.
        const value = parseEther("0.1");
        await exchange.exchange(
            ZERO_ADDR, crv.address, value, 0, { value: value }
        )
        let amountCrvSent = await crv.balanceOf(signers[0].address);
        await crv.transfer(AlluoVault.address, amountCrvSent)
        let afterAccrued = await AlluoVault.shareholderAccruedRewards(signers[0].address);

        console.log("Shareholder accumulated after some erc20s are sitting", afterAccrued);
        expect(Number(afterAccrued[0][0].amount)).greaterThanOrEqual(Number(beforeAccrued[0][0].amount.add(amountCrvSent)));
        console.log("Difference", afterAccrued[0][0].amount.sub(beforeAccrued[0][0].amount.add(amountCrvSent)));
        await AlluoVault.claimRewardsFromPool();
        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    })

    it("Wait for rewards then loop rewards.", async function () {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        console.log("Balance before of Cvx-ETH Lp", lpBalance)
        await cvxEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await alluoPool.farm();

        console.log("crv-ETH staked", await alluoPool.fundsLocked());
        expect(Number(await alluoPool.fundsLocked())).greaterThan(0);
    })
    it("Deposit some Lp for vault tokens and then burn them for the same LPs back.", async function () {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        await cvxEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);

        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await alluoPool.farm();


        await AlluoVault.withdraw(lpBalance, signers[0].address, signers[0].address);
        await AlluoVault.claimRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).equal(0)
        // this must be greater than or equal because the base pool APY is quite high.
        expect(Number(await cvxEth.balanceOf(signers[0].address))).greaterThanOrEqual(Number(lpBalance))
        console.log("Rewardsin LP", Number(await rewardToken.balanceOf(signers[0].address)));
        expect(Number(await rewardToken.balanceOf(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault.totalAssets())).equal(0)
        expect(Number(await AlluoVault.totalSupply())).equal(0)
    })
    it("After looping rewards, expect fundsLocked to increase.", async function () {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        console.log("Balance before of Cvx-ETH Lp", lpBalance)
        await cvxEth.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await alluoPool.farm();

        const initialRewards = await alluoPool.fundsLocked();


        await skipDays(0.01);
        await alluoPool.claimRewardsFromPool();


        const crvAccumulated = await crv.balanceOf(alluoPool.address);
        const cvxAccumulated = await cvx.balanceOf(alluoPool.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)


        await alluoPool.farm();

        const compoundedRewards = await alluoPool.fundsLocked();

        console.log("crv-ETH staked after", await alluoPool.fundsLocked());
        expect(Number(compoundedRewards)).greaterThan(Number(initialRewards));
    })
    it("Deposit frax to enter pool.", async function () {
        // const fraxBalance = await frax.balanceOf(signers[0].address);
        // console.log("Balance before of Frax balance", fraxBalance)
        const fraxBalance = parseEther("100");
        await frax.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(fraxBalance, frax.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    })

    it("Deposit usdc to enter pool.", async function () {
        // const fraxBalance = await frax.balanceOf(signers[0].address);
        // console.log("Balance before of Frax balance", fraxBalance)
        const usdcBalance = parseUnits("100", 6);
        await usdc.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
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
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
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
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, cvxEth.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await cvxEth.balanceOf(signers[i].address)
            await cvxEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
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
            expect(Number(signerBalancesBefore[i])).equal(Number(await cvxEth.balanceOf(signers[i + 1].address)))
        }
    })
    it("Multiple deposits should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, cvxEth.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = parseEther("100")
            await cvxEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
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
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(2)).equal(Number(expectBalance).toPrecision(2))
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
        await AlluoVault.setAdminFee(100);
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, cvxEth.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await cvxEth.balanceOf(signers[i].address)
            await cvxEth.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(0.01);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.farm();

        await skipDays(0.01);
        await AlluoVault.connect(signers[1]).claimRewards();
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"
        expect(Number(await AlluoVault.earned(gnosis))).greaterThan(0);
    })
})