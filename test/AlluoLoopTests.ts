import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";
import { afterEach, before } from "mocha";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICurvePool, ICvxBooster, IERC20MetadataUpgradeable, IExchange } from "../typechain";


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

describe("Alluo Pool Tests", function () {
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let cvxBooster: ICvxBooster;
    let exchange: Exchange;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault1: AlluoVaultUpgradeable;
    let AlluoVault2: AlluoVaultUpgradeable;
    let AlluoVault3: AlluoVaultUpgradeable;

    let rewardToken: IERC20MetadataUpgradeable;
    let cvxEth: IERC20MetadataUpgradeable;
    let alluoPool: IAlluoPool;

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
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        cvxEth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");

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

        const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")
        value = parseEther("100.0");

        await exchange.exchange(
            ZERO_ADDR, cvxEth.address, value, 0, { value: value }
        )
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
        AlluoVault1 = await upgrades.deployProxy(AlluoVaultFactory, [
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


        AlluoVault2 = await upgrades.deployProxy(AlluoVaultFactory, [
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


        AlluoVault3 = await upgrades.deployProxy(AlluoVaultFactory, [
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
            [AlluoVault1.address, AlluoVault2.address, AlluoVault3.address],
            "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
            64, //Pool number convex
            cvx.address
        ]) as AlluoVaultPool
        await AlluoVault1.setPool(alluoPool.address);
        await AlluoVault2.setPool(alluoPool.address);
        await AlluoVault3.setPool(alluoPool.address);

        await AlluoVault1.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault2.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault3.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

        await AlluoVault1.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault2.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault3.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

    });

    afterEach(async () => {
    })
    it("One user, multiple vaults", async () => {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        const deposit = lpBalance.div(4)
        console.log("Balance before of Cvx-ETH Lp", deposit)
        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        await cvxEth.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(deposit, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        await cvxEth.approve(AlluoVault3.address, ethers.constants.MaxUint256);
        await AlluoVault3.deposit(deposit, signers[0].address);
        await AlluoVault3.stakeUnderlying();

        await skipDays(0.01);

        await alluoPool.farm();

        expect(Number(await AlluoVault1.earned(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault2.earned(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault3.earned(signers[0].address))).greaterThan(0)

    })

    it("One user, multiple vaults, two loops", async () => {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        const deposit = lpBalance.div(10)
        console.log("Balance before of Cvx-ETH Lp", deposit)
        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        await cvxEth.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(deposit, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        await cvxEth.approve(AlluoVault3.address, ethers.constants.MaxUint256);
        await AlluoVault3.deposit(deposit, signers[0].address);
        await AlluoVault3.stakeUnderlying();

        await skipDays(0.01);
        await alluoPool.farm();

        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        await cvxEth.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(deposit, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        await cvxEth.approve(AlluoVault3.address, ethers.constants.MaxUint256);
        await AlluoVault3.deposit(deposit, signers[0].address);
        await AlluoVault3.stakeUnderlying();

        await skipDays(0.01);
        await alluoPool.farm();
        let userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault1.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))
        userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault2.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))
        userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault3.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))

        // Skip 7 days to bypass whaleProtection
        await skipDays(7);
        await AlluoVault1.withdraw(await AlluoVault1.balanceOf(signers[0].address), signers[0].address, signers[0].address)
        await AlluoVault2.withdraw(await AlluoVault2.balanceOf(signers[0].address), signers[0].address, signers[0].address)
        await AlluoVault3.withdraw(await AlluoVault3.balanceOf(signers[0].address), signers[0].address, signers[0].address)

        expect(await cvxEth.balanceOf(signers[0].address)).equal(lpBalance);
    })

    it("Multiple depositors, single vault, two loops", async () => {
        for (let i = 1; i < 10; i++) {
            getLPTokens(signers[i], parseEther("10"))
            const lpBalance = await cvxEth.balanceOf(signers[i].address);
            await cvxEth.connect(signers[i]).approve(AlluoVault1.address, ethers.constants.MaxUint256);
            await AlluoVault1.connect(signers[i]).deposit(lpBalance, signers[i].address);
            await AlluoVault1.connect(signers[i]).stakeUnderlying();
        }
        await skipDays(0.01);
        await alluoPool.farm();
        await skipDays(0.1);
        await alluoPool.farm();

        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).claimRewards();
        }
    })
    it("Multiple depositors, multiple vaults, two loops", async () => {
        for (let i = 1; i < 10; i++) {
            getLPTokens(signers[i], parseEther("10"))
            const lpBalance = await cvxEth.balanceOf(signers[i].address);
            const deposit = lpBalance.div(3)
            await cvxEth.connect(signers[i]).approve(AlluoVault1.address, ethers.constants.MaxUint256);
            await AlluoVault1.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault1.connect(signers[i]).stakeUnderlying();

            await cvxEth.connect(signers[i]).approve(AlluoVault2.address, ethers.constants.MaxUint256);
            await AlluoVault2.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault2.connect(signers[i]).stakeUnderlying();

            await cvxEth.connect(signers[i]).approve(AlluoVault3.address, ethers.constants.MaxUint256);
            await AlluoVault3.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault3.connect(signers[i]).stakeUnderlying();

        }
        await skipDays(0.01);
        await alluoPool.farm();
        await skipDays(0.1);
        await alluoPool.farm();

        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).claimRewards();
            await AlluoVault2.connect(signers[i]).claimRewards();
            await AlluoVault3.connect(signers[i]).claimRewards();
        }

        expect(Number((Number(await alluoPool.balances(AlluoVault1.address)) / 10 ** 18).toFixed(5))).equal(0)
        expect(Number((Number(await alluoPool.balances(AlluoVault2.address)) / 10 ** 18).toFixed(5))).equal(0)
        expect(Number((Number(await alluoPool.balances(AlluoVault3.address)) / 10 ** 18).toFixed(5))).equal(0)



        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).withdraw(await AlluoVault1.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            await AlluoVault2.connect(signers[i]).withdraw(await AlluoVault2.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            await AlluoVault3.connect(signers[i]).withdraw(await AlluoVault3.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            expect(await AlluoVault1.balanceOf(signers[i].address)).equal(0)
            expect(await AlluoVault2.balanceOf(signers[i].address)).equal(0)
            expect(await AlluoVault3.balanceOf(signers[i].address)).equal(0)

        }

    })


    it("One user, multiple vaults, multiple loops", async () => {
        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        const deposit = lpBalance.div(10)
        console.log("Balance before of Cvx-ETH Lp", deposit)
        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        await cvxEth.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(deposit, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        await cvxEth.approve(AlluoVault3.address, ethers.constants.MaxUint256);
        await AlluoVault3.deposit(deposit, signers[0].address);
        await AlluoVault3.stakeUnderlying();

        for (let j = 0; j < 5; j++) {
            await skipDays(0.01);
            await alluoPool.farm();
            await skipDays(0.1);
            await alluoPool.farm();
        }
        let userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault1.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))
        userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault2.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))
        userBalance = await usdc.balanceOf(signers[0].address);
        await AlluoVault3.claimRewardsInNonLp(usdc.address);
        expect(Number(await usdc.balanceOf(signers[0].address))).greaterThan(Number(userBalance))

        await AlluoVault1.withdraw(await AlluoVault1.balanceOf(signers[0].address), signers[0].address, signers[0].address)
        await AlluoVault2.withdraw(await AlluoVault2.balanceOf(signers[0].address), signers[0].address, signers[0].address)
        await AlluoVault3.withdraw(await AlluoVault3.balanceOf(signers[0].address), signers[0].address, signers[0].address)

        expect(await cvxEth.balanceOf(signers[0].address)).equal(lpBalance);

    })

    it("Multiple depositors, single vault, multiple loops", async () => {
        for (let i = 1; i < 10; i++) {
            getLPTokens(signers[i], parseEther("10"))
            const lpBalance = await cvxEth.balanceOf(signers[i].address);
            await cvxEth.connect(signers[i]).approve(AlluoVault1.address, ethers.constants.MaxUint256);
            await AlluoVault1.connect(signers[i]).deposit(lpBalance, signers[i].address);
            await AlluoVault1.connect(signers[i]).stakeUnderlying();
        }
        for (let j = 0; j < 5; j++) {
            await skipDays(0.01);
            await alluoPool.farm();
            await skipDays(0.1);
            await alluoPool.farm();
        }

        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).claimRewards();
        }
    })
    it("Multiple depositors, multiple vaults, multiple loops", async () => {
        for (let i = 1; i < 10; i++) {
            getLPTokens(signers[i], parseEther("10"))
            const lpBalance = await cvxEth.balanceOf(signers[i].address);
            const deposit = lpBalance.div(3)
            await cvxEth.connect(signers[i]).approve(AlluoVault1.address, ethers.constants.MaxUint256);
            await AlluoVault1.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault1.connect(signers[i]).stakeUnderlying();

            await cvxEth.connect(signers[i]).approve(AlluoVault2.address, ethers.constants.MaxUint256);
            await AlluoVault2.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault2.connect(signers[i]).stakeUnderlying();

            await cvxEth.connect(signers[i]).approve(AlluoVault3.address, ethers.constants.MaxUint256);
            await AlluoVault3.connect(signers[i]).deposit(deposit, signers[i].address);
            await AlluoVault3.connect(signers[i]).stakeUnderlying();

        }
        for (let j = 0; j < 5; j++) {
            await skipDays(0.01);
            await alluoPool.farm();
            await skipDays(0.1);
            await alluoPool.farm();
        }

        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).claimRewards();
            await AlluoVault2.connect(signers[i]).claimRewards();
            await AlluoVault3.connect(signers[i]).claimRewards();
        }

        expect(Number((Number(await alluoPool.balances(AlluoVault1.address)) / 10 ** 18).toFixed(5))).equal(0)
        expect(Number((Number(await alluoPool.balances(AlluoVault2.address)) / 10 ** 18).toFixed(5))).equal(0)
        expect(Number((Number(await alluoPool.balances(AlluoVault3.address)) / 10 ** 18).toFixed(5))).equal(0)



        for (let i = 1; i < 10; i++) {
            await AlluoVault1.connect(signers[i]).withdraw(await AlluoVault1.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            await AlluoVault2.connect(signers[i]).withdraw(await AlluoVault2.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            await AlluoVault3.connect(signers[i]).withdraw(await AlluoVault3.balanceOf(signers[i].address), signers[i].address, signers[i].address)
            expect(await AlluoVault1.balanceOf(signers[i].address)).equal(0)
            expect(await AlluoVault2.balanceOf(signers[i].address)).equal(0)
            expect(await AlluoVault3.balanceOf(signers[i].address)).equal(0)

        }

    })


    async function getLPTokens(signer: SignerWithAddress, amount: BigNumber) {
        await exchange.connect(signer).exchange(
            ZERO_ADDR, cvxEth.address, amount, 0, { value: amount }
        )
    }
})

