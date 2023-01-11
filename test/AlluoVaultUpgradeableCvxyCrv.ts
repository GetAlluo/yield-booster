import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICurvePool, IERC20MetadataUpgradeable } from "../typechain";


async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

describe("Alluo Vault Upgradeable Tests", function () {

    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable,
        crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, rewardToken: IERC20MetadataUpgradeable,
        yCRVToken: IERC20MetadataUpgradeable, ycrv: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault: AlluoVaultUpgradeable;
    let alluoPool: IAlluoPool;
    let yCRVPool: ICurvePool;
    let admin: SignerWithAddress;

    async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
        await ethers.provider.send(
            'hardhat_impersonateAccount',
            [address]
        );

        return await ethers.getSigner(address);
    }

    async function resetNetwork() {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 16370507,
                },
            },],
        });
    }

    before(async () => {

        await resetNetwork();
        console.log('\n', "||| Confirm that the _grantRoles(.., msg.sender) in AlluoVaultUpgradeable.sol has been uncommented to ensure tests are functioning correctly |||", '\n')

    });

    beforeEach(async () => {

        await resetNetwork();

        signers = await ethers.getSigners();
        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        yCRVPool = await ethers.getContractAt("ICurvePool", "0x453d92c7d4263201c69aacfaf589ed14202d83a4");
        yCRVToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x453d92c7d4263201c69aacfaf589ed14202d83a4");
        ycrv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xfcc5c47be19d06bf83eb04298b026f81069ff65b");
        admin = await getImpersonatedSigner("0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3");

        const value = parseEther("10.0");

        await exchange.exchange(
            ZERO_ADDR, crv.address, value, 0, { value: value }
        )
        const balanceCRV = await crv.balanceOf(signers[0].address);
        await crv.approve(yCRVPool.address, balanceCRV);
        await yCRVPool.add_liquidity([balanceCRV, 0], 0);

        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
        AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
            "CRV-yCRV Vault",
            "yCRV",
            yCRVToken.address, // underlying
            rewardToken.address, // Curve CVX-ETH Convex Deposit (cvxcrvCVX...)
            ZERO_ADDR, // set pool later
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
            [crv.address, cvx.address], //
            [crv.address, ycrv.address], // entry tokens to curve pool
            124,
            yCRVPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoVaultUpgradeable;


        alluoPool = await ethers.getContractAt("AlluoVaultPool", "0x470e486acA0e215C925ddcc3A9D446735AabB714");
        await alluoPool.connect(admin).editVault(true, AlluoVault.address);

        // let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");

        // alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
        //     rewardToken.address,
        //     gnosis,
        //     [crv.address, cvx.address],
        //     [AlluoVault.address],
        //     "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address for boosting (CRV/eth)
        //     64, //Pool number convex
        //     cvx.address
        // ]) as AlluoVaultPool

        await AlluoVault.setPool(alluoPool.address);
        await AlluoVault.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

    });

    afterEach(async () => {
        expect(await AlluoVault.totalSupply()).equal(await AlluoVault.totalAssets());
    });

    it("yCRV: Deposit some LP", async function () {

        const lpBalance = await yCRVToken.balanceOf(signers[0].address);
        await yCRVToken.approve(AlluoVault.address, lpBalance);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        expect(Number(await AlluoVault.balanceOf(signers[0].address))).greaterThan(0);
        expect(Number(lpBalance)).equal(Number(await AlluoVault.balanceOf(signers[0].address)));

    })

    it("yCRV: Deposit some LP and wait for rewards to accumulate", async function () {
        const lpBalance = await yCRVToken.balanceOf(signers[0].address);
        await yCRVToken.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    });

    it("yCRV: Wait for rewards then loop rewards.", async function () {
        const lpBalance = await yCRVToken.balanceOf(signers[0].address);
        await yCRVToken.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        const fundsBefore = await alluoPool.fundsLocked();
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));
        await alluoPool.connect(admin).farm();

        console.log("LPs staked", await alluoPool.fundsLocked());
        expect(Number(await alluoPool.fundsLocked())).greaterThan(Number(fundsBefore));
    })
    it("yCRV: Deposit some Lp for vault tokens and then burn them for the same LPs back.", async function () {
        const lpBalance = await yCRVToken.balanceOf(signers[0].address);
        await yCRVToken.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);

        await AlluoVault.stakeUnderlying();
        await skipDays(1);
        await alluoPool.connect(admin).farm();
        await skipDays(1);
        console.log("Shareholder accumulated", await AlluoVault.shareholderAccruedRewards(signers[0].address));

        await AlluoVault.withdraw(lpBalance, signers[0].address, signers[0].address);
        await AlluoVault.claimRewards();

        expect(await AlluoVault.balanceOf(signers[0].address)).equal(0)
        // this must be greater than or equal because the base pool APY is quite high.
        expect(Number(await yCRVToken.balanceOf(signers[0].address))).greaterThanOrEqual(Number(lpBalance))
        console.log("Rewards in LP", Number(await rewardToken.balanceOf(signers[0].address)));
        expect(Number(await rewardToken.balanceOf(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault.totalAssets())).equal(0)
        expect(Number(await AlluoVault.totalSupply())).equal(0)
    })

    it("yCRV: After looping rewards, expect fundsLocked to increase.", async function () {

        const lpBalance = await yCRVToken.balanceOf(signers[0].address);
        await yCRVToken.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.deposit(lpBalance, signers[0].address);
        await AlluoVault.stakeUnderlying();
        console.log('\nfunds locked', await alluoPool.fundsLocked());
        await skipDays(0.1);
        await alluoPool.connect(admin).farm();

        const initialRewards = await alluoPool.fundsLocked();

        await skipDays(0.5);
        await alluoPool.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(alluoPool.address);
        const cvxAccumulated = await cvx.balanceOf(alluoPool.address);
        console.log(crvAccumulated)
        console.log(cvxAccumulated)

        await alluoPool.connect(admin).farm();

        const compoundedRewards = await alluoPool.fundsLocked();
        console.log("LPs staked after", compoundedRewards);
        expect(Number(compoundedRewards)).greaterThan(Number(initialRewards));
    })

    it("yCRV: Deposit frax to enter pool.", async function () {

        await exchange.exchange(
            ZERO_ADDR, frax.address, parseEther("100"), 0, { value: parseEther("100") }
        )
        const fraxBalance = parseEther("10");
        await frax.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(fraxBalance, frax.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(5);

        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(0)
        expect(Number(cvxAccumulated)).greaterThan(0)
    })

    it("yCRV: Deposit usdc to enter pool.", async function () {
        const usdcBalance = await usdc.balanceOf(signers[0].address);
        await exchange.exchange(
            ZERO_ADDR, usdc.address, parseEther("100"), 0, { value: parseEther("100") }
        )
        await usdc.approve(AlluoVault.address, usdcBalance);

        const crvBefore = await crv.balanceOf(AlluoVault.address);
        const cvxBefore = await cvx.balanceOf(AlluoVault.address);

        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(Number(crvBefore));
        expect(Number(cvxAccumulated)).greaterThan(Number(cvxBefore));
    })

    it("yCRV: Deposit usdt to enter pool (non pool token).", async function () {
        await exchange.exchange(
            ZERO_ADDR, usdt.address, parseEther("100"), 0, { value: parseEther("100") }
        )
        const usdtBalance = parseUnits("100", 6);
        const crvBefore = await crv.balanceOf(AlluoVault.address);
        const cvxBefore = await cvx.balanceOf(AlluoVault.address);

        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const crvAccumulated = await crv.balanceOf(AlluoVault.address);
        const cvxAccumulated = await cvx.balanceOf(AlluoVault.address);
        expect(Number(crvAccumulated)).greaterThan(Number(crvBefore));
        expect(Number(cvxAccumulated)).greaterThan(Number(cvxBefore));
    })

    it("yCRV: Deposit usdc to enter pool and exit again in USDC", async function () {

        await exchange.exchange(
            ZERO_ADDR, usdc.address, parseEther("100"), 0, { value: parseEther("100") }
        )
        const usdcBalance = parseUnits("100", 6);
        await usdc.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdcBalance, usdc.address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();

        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdc.address);
        expect(await AlluoVault.balanceOf(signers[0].address)).to.be.eq(0);

    })

    it("yCRV: Deposit usdt to enter pool (non pool token) and exit again in a non pool token.", async function () {
        await exchange.exchange(
            ZERO_ADDR, usdt.address, parseEther("100"), 0, { value: parseEther("100") }
        )
        const usdtBalance = parseUnits("100", 6);
        await usdt.approve(AlluoVault.address, ethers.constants.MaxUint256);
        await AlluoVault.depositWithoutLP(usdtBalance, usdt.address);
        const usdtBefore = await usdt.balanceOf(signers[0].address);
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        const lpBalance = await AlluoVault.balanceOf(signers[0].address);
        await AlluoVault.withdrawToNonLp(lpBalance, signers[0].address, signers[0].address, usdt.address);
        expect(await usdt.balanceOf(signers[0].address)).to.be.gt(usdtBefore);
        console.log(usdtBefore, await usdt.balanceOf(signers[0].address));
    })

    it("yCRV: Multiple deposits and withdrawals should return correct LP amounts", async function () {
        let signerBalancesBefore = []
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, yCRVToken.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await yCRVToken.balanceOf(signers[i].address)
            await yCRVToken.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
            signerBalancesBefore.push(await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        for (let i = 1; i < 6; i++) {
            let signerBalance = await AlluoVault.balanceOf(signers[i].address)
            await AlluoVault.connect(signers[i]).withdraw(signerBalance, signers[i].address, signers[i].address);
            expect(Number(await AlluoVault.balanceOf(signers[i].address))).equal(0);
        }

        for (let i = 0; i < 5; i++) {
            expect(Number(signerBalancesBefore[i])).equal(Number(await yCRVToken.balanceOf(signers[i + 1].address)))
        }
    })
    it("yCRV: Multiple deposits should return correct LP amounts and reward distribution (equal here)", async function () {
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, yCRVToken.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = parseEther("100")
            await yCRVToken.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
        await AlluoVault.connect(signers[1]).claimRewards();
        let expectBalance = await rewardToken.balanceOf(signers[1].address)

        for (let i = 2; i < 6; i++) {
            await AlluoVault.connect(signers[i]).claimRewards();
            // Small dust
            expect(Number(await rewardToken.balanceOf(signers[i].address)).toPrecision(2)).equal(Number(expectBalance).toPrecision(2))
            console.log(`Reward tokens for signer ${i}: ${await rewardToken.balanceOf(signers[i].address)}`)
        }
    })


    it("yCRV: Multiple deposits and withdrawals in nonLP tokens should return correct LP amounts and reward distribution (equal here)", async function () {
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
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
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

    it("yCRV: After some loops, the multisig should be able to claim fees accumulated.", async function () {
        await AlluoVault.setAdminFee(100);
        for (let i = 1; i < 6; i++) {
            await exchange.connect(signers[i]).exchange(
                ZERO_ADDR, yCRVToken.address, parseEther("10"), 0, { value: parseEther("10") }
            )
            let lpBalance = await yCRVToken.balanceOf(signers[i].address)
            await yCRVToken.connect(signers[i]).approve(AlluoVault.address, ethers.constants.MaxUint256);
            await AlluoVault.connect(signers[i]).deposit(lpBalance, signers[i].address);
            console.log(`Signer ${i}:`, await AlluoVault.balanceOf(signers[i].address));
        }
        await AlluoVault.stakeUnderlying();
        await skipDays(10);
        await AlluoVault.claimRewardsFromPool();
        await alluoPool.connect(admin).farm();

        await skipDays(10);
        await AlluoVault.connect(signers[1]).claimRewards();
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"
        expect(Number(await AlluoVault.earned(gnosis))).greaterThan(0);
    })
});

