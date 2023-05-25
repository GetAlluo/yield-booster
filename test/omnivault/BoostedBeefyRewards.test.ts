import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
function generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
describe("Boosted beefy Omnivault Tests", function () {
    let omnivault: AlluoOmnivault;
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable, ldo: IERC20MetadataUpgradeable;
    let mooLp1: IERC20MetadataUpgradeable, mooLp2: IERC20MetadataUpgradeable, mooLp3: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let admin: SignerWithAddress;
    const tolerance = 1e15; // Adjust the tolerance value as needed
    const lp1BoostAddress = "0x358b7d1a3b7e5c508c40756242f55991a354cd41"
    // Existing setup support:
    // https://app.beefy.com/vault/curve-op-f-wsteth
    // https://app.beefy.com/vault/stargate-op-usdc
    // https://app.beefy.com/vault/hop-op-usdc
    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.OPTIMISM_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 88995824,
                },
            },],
        });
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
        mooLp1 = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x0892a178c363b4739e5Ac89E9155B9c30214C0c0');
        mooLp2 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xe536F8141D8EB7B1f096934AF3329cB581bFe995");
        mooLp3 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE2f035f59De6a952FF699b4EDD0f99c466f25fEc");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
        ldo = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xfdb794692724153d1488ccdbe0c56c252596735f")
        exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
        admin = signers[19];
        omnivault = (await upgrades.deployProxy(omniVaultFactory, [
            exchange.address,
            usdc.address,
            [mooLp1.address],
            [100],
            [lp1BoostAddress],
            admin.address,
            0,
            600
        ], {
            initializer: "initialize",
        })) as AlluoOmnivault;
        // These integration tests will charge 10% fee on yield.
        await omnivault.connect(admin).setFeeOnYield(1000);
        await omnivault.connect(admin).setRewardTokenToMinSwapAmount(ldo.address, ethers.utils.parseEther("1"));

        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }
    });
    describe("Core functions of the vaults", function () {
        this.beforeEach(async function () {
            // Prevent fee skimming here so that we can better illustrate other mechanics
            await omnivault.connect(admin).setFeeOnYield(0)
        })
        it("Deposit when there is only 1 moo LP vault. All funds should go to that Moo vault.", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            expect(await omnivault.getVaultBalanceOf(mooLp1.address)).to.greaterThan(0);
            expect(await usdc.balanceOf(omnivault.address)).equal(0);
        });
        it("Withdraw when there is only 1 moo LP vault. All funds should go back to the user in USDC.", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let signerUSDCBalanceBeforeWithdrawal = await usdc.balanceOf(signers[0].address);

            await omnivault.connect(signers[0]).withdraw(usdc.address, 100);
            // Should equal zero because signer is the only depositor
            expect(await omnivault.getVaultBalanceOf(mooLp1.address)).to.equal(0);
            expect(signerUSDCBalanceBeforeWithdrawal).lessThan(await usdc.balanceOf(signers[0].address));
            expect(await usdc.balanceOf(omnivault.address)).equal(0);

        })

        it("Multiple depositors should be able to deposit and then withdraw fully. All funds should go back to the user in USDC.", async function () {
            for (let i = 0; i < 5; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
                await omnivault.connect(signers[i]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            }
            for (let i = 0; i < 5; i++) {
                await omnivault.connect(signers[i]).withdraw(usdc.address, 100);
            }
            expect(await omnivault.getVaultBalanceOf(mooLp1.address)).to.equal(0);
            expect(await usdc.balanceOf(omnivault.address)).equal(0);

        })


        it("Test depositing into an omnivault with multiple moo vaults", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [33, 33, 33], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero]);
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            expect(await omnivault.getVaultBalanceOf(mooLp1.address)).to.greaterThan(0);
            expect(await omnivault.getVaultBalanceOf(mooLp2.address)).to.greaterThan(0);
            expect(await omnivault.getVaultBalanceOf(mooLp3.address)).to.greaterThan(0);
            expect(await usdc.balanceOf(omnivault.address)).equal(0);
        })

        // Use mocks separately to test checking the mappings and enumerable sets directly. This comes later.
    })


    describe("Redistribution tests", function () {


        it("Remain in same vault. This should only loop the boost rewards. However, there are insufficient rewards so do nothing", async function () {
            // Set fee to 0 to prevent fee skimming. This is used to better illustrate the underlying mechanics
            await omnivault.connect(admin).setFeeOnYield(0);
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp1TokensBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            await omnivault.connect(admin).redistribute([], [], []);
            let mooLp1Tokens = await omnivault.getVaultBalanceOf(mooLp1.address);
            expect(mooLp1TokensBefore).to.be.equal(mooLp1Tokens);
            expect(await omnivault.adminFees(usdc.address)).to.equal(0);
        })

        it("Remain in same vault. This should only loop the boost rewards.", async function () {


            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("20000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("20000", 6));
            let mooLp1TokensBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            // Fake and send some LDO tokens to the omnivault
            await usdc.connect(signers[0]).approve(exchange.address, ethers.utils.parseUnits("10000", 6));
            await exchange.connect(signers[0]).exchange(usdc.address, ldo.address, ethers.utils.parseUnits("10000", 6), 0);
            await ldo.connect(signers[0]).transfer(omnivault.address, await ldo.balanceOf(signers[0].address));

            await omnivault.connect(admin).redistribute([], [], []);
            expect(Number(await omnivault.getVaultBalanceOf(mooLp1.address))).to.be.greaterThan(Number(mooLp1TokensBefore));
            expect(await omnivault.adminFees(usdc.address)).to.greaterThan(0);
        })


        it("Redistribution from mooVault1 --> mooVault2", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp2TokensBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            await omnivault.connect(admin).redistribute([mooLp2.address], [100], [ethers.constants.AddressZero]);
            let mooLp2Tokens = await omnivault.getVaultBalanceOf(mooLp2.address);
            expect(mooLp2TokensBefore).to.equal(0);
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));

        })
        it("Redistribution from mooVault1 --> mooVault2 and mooVault3 in even proportion", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp2TokensBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3TokensBefore = await omnivault.getVaultBalanceOf(mooLp3.address);
            await omnivault.connect(admin).redistribute([mooLp2.address, mooLp3.address], [50, 50], [ethers.constants.AddressZero, ethers.constants.AddressZero]);
            let mooLp2Tokens = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3Tokens = await omnivault.getVaultBalanceOf(mooLp3.address);
            expect(mooLp2TokensBefore).to.equal(0);
            expect(mooLp3TokensBefore).to.equal(0);
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));
            expect(Number(mooLp3Tokens)).greaterThan(Number(mooLp3TokensBefore));

        })
        it("Redistribution from mooVault1 --> 33% of each mooVault1, mooVault2 and mooVault3", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp1TokensBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            let mooLp2TokensBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3TokensBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [33, 33, 33], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero]);
            let mooLp1Tokens = await omnivault.getVaultBalanceOf(mooLp1.address);
            let mooLp2Tokens = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3Tokens = await omnivault.getVaultBalanceOf(mooLp3.address);


            expect(Number(mooLp1TokensBefore)).to.be.greaterThan(0)
            expect(mooLp2TokensBefore).to.equal(0);
            expect(mooLp3TokensBefore).to.equal(0);

            expect(Number(await omnivault.getVaultBalanceOf(mooLp1.address))).to.be.lessThan(Number(mooLp1TokensBefore));
            expect(Number(mooLp1Tokens)).lessThan(Number(mooLp1TokensBefore));
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));
            expect(Number(mooLp3Tokens)).greaterThan(Number(mooLp3TokensBefore));

        })

        it("Redistribution using swapOneVault should work for 1 moo vault --> 1 moo vault", async function () {
            // This test is to reach 100% coverage for boost.
            await omnivault.connect(admin).setFeeOnYield(0);
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            // Swap all to mooLp2
            await omnivault.connect(admin).redistribute([mooLp2.address], [100], [ethers.constants.AddressZero]);

            await omnivault.connect(admin).swapOneVault(mooLp2.address, [mooLp1.address], [100], [lp1BoostAddress]);
            expect(await omnivault.getVaultBalanceOf(mooLp2.address)).to.equal(0);
            expect(Number(await omnivault.getVaultBalanceOf(mooLp1.address))).to.be.greaterThan(0);

        })
    })
    describe("Integration testing by simulating rising LP value", function () {
        it("Simulate these LPs rising in value", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            let totalFunds = await omnivault.getVaultBalanceOf(mooLp1.address);
            let simulatedWithdrawValueBefore = await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100);
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("5"), mooLp1.address);
            // The LPs should be worth more, let's check this.
            let simulatedWithdrawValueAfter = await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100);
            let totalFundsAfter = await omnivault.getVaultBalanceOf(mooLp1.address);
            expect(Number(simulatedWithdrawValueAfter)).greaterThan(Number(simulatedWithdrawValueBefore));
            // These numbers should be equal, to check that the vault is purely only gaining value from the LPs
            expect(totalFundsAfter).to.equal(totalFunds);
        })
        it("Multiple depositors should receive more USDC when the LPs rise enough in value (accounting for slippage, fees)", async function () {
            let amountIn = ethers.utils.parseUnits("1000", 6);
            for (let i = 0; i < 5; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, amountIn);
                await omnivault.connect(signers[i]).deposit(usdc.address, amountIn);
            }
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("60"), mooLp1.address);
            for (let i = 0; i < 5; i++) {
                let balUsdcBefore = await usdc.balanceOf(signers[i].address);
                await omnivault.connect(signers[i]).withdraw(usdc.address, 100);
                let balUsdcAfter = await usdc.balanceOf(signers[i].address);
                let amountOut = balUsdcAfter.sub(balUsdcBefore);
                expect(Number(amountOut)).greaterThan(Number(amountIn));
            }
        })

        it("We should be able to track the performance of the vault overtime using an account that deposits an initial 1% amount", async function () {
            let amountIn = ethers.utils.parseUnits("1000", 6);
            await usdc.connect(signers[0]).approve(omnivault.address, amountIn);
            await omnivault.connect(signers[0]).deposit(usdc.address, amountIn);
            for (let i = 0; i < 10; i++) {
                let randomReward = generateRandomNumber(1, 15);
                await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther(String(randomReward)), mooLp1.address);
                console.log("Value of investment", Number(await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100)) / 1000000);
            }
        })
    })

    describe("Test to check fee collection", function () {

        it("Should result in NO fee collection as fees are set to zero", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let adminUSDCBalanceBefore = await usdc.balanceOf(admin.address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            expect(await usdc.balanceOf(admin.address)).to.be.equal(adminUSDCBalanceBefore);
        })
        it("Should result in fee collection for full withdrawals", async function () {
            await omnivault.connect(admin).setFeeOnYield(1000);

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            // Skip some time to force fee skimming
            await ethers.provider.send("evm_increaseTime", [700]);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            console.log(await omnivault.adminFees(usdc.address), "Fee collected")
            expect(Number(await omnivault.adminFees(usdc.address))).to.be.greaterThan(0);

        })


        it("If fee is 100% on yield, the user should only receive back the principal", async function () {
            await omnivault.connect(admin).setFeeOnYield(10000);

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let userUSDCBalanceBefore = await usdc.balanceOf(signers[0].address);
            // Skip some time to force fee skimming
            await ethers.provider.send("evm_increaseTime", [700]);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            let userUSDCBalanceAfter = await usdc.balanceOf(signers[0].address);
            console.log(await omnivault.adminFees(usdc.address), "Fee collected")

            expect(Number(await omnivault.adminFees(usdc.address))).to.be.greaterThan(0);
            // Allow margin of error for slippage. But the user should not have received more than the principal

            expect(Number(userUSDCBalanceAfter.sub(userUSDCBalanceBefore))).to.be.closeTo(Number(ethers.utils.parseUnits("1000", 6)), 10000000);


        })

        // These are complex tests to make sure fee collection works as expected
        it("Harvest fees, and make sure the balance of moo lps correspond to the depositor balances correctly with 1 moo vault", async function () {
            await omnivault.connect(admin).setFeeOnYield(1000);
            for (let i = 0; i < 10; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
                await omnivault.connect(signers[i]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            }
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            // Skip some time to force fee skimming
            await ethers.provider.send("evm_increaseTime", [700]);
            await omnivault.skimYieldFeeAndSendToAdmin();

            let allActiveUsers = await omnivault.getActiveUsers();
            let mooLp1BalanceBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            let mooLp2BalanceBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3BalanceBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            let mooLpCounter1 = 0;
            let mooLpCounter2 = 0;
            let mooLpCounter3 = 0;
            for (let i = 0; i < allActiveUsers.length; i++) {
                let balanceArrays = await omnivault.balanceOf(allActiveUsers[i]);
                let balances = balanceArrays[1];
                let vaults = balanceArrays[0];
                for (let j = 0; j < balanceArrays[0].length; j++) {
                    if (vaults[j] == mooLp1.address && Number(balances[j]) > 0) {
                        mooLpCounter1 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp2.address && Number(balances[j]) > 0) {
                        mooLpCounter2 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp3.address && Number(balances[j]) > 0) {
                        mooLpCounter3 += Number(balances[j]);
                    }
                }

            }
            expect(Number(mooLpCounter1)).to.be.closeTo(Number(mooLp1BalanceBefore), tolerance);
            expect(Number(mooLpCounter2)).to.be.closeTo(Number(mooLp2BalanceBefore), tolerance);
            expect(Number(mooLpCounter3)).to.be.closeTo(Number(mooLp3BalanceBefore), tolerance);
        })


        it("Harvest fees, and make sure the balance of moo lps correspond to the depositor balances correctly with 3 moo vault", async function () {
            await omnivault.connect(admin).setFeeOnYield(1000);
            for (let i = 0; i < 10; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
                await omnivault.connect(signers[i]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            }
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [33, 33, 33], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero])
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            await simulateIncreasedValueOfLP(mooLp2.address, ethers.utils.parseEther("10"), mooLp2.address);
            await simulateIncreasedValueOfLP(mooLp3.address, ethers.utils.parseEther("10"), mooLp3.address);
            // Skip some time to force fee skimming
            await ethers.provider.send("evm_increaseTime", [700]);
            await omnivault.skimYieldFeeAndSendToAdmin();

            let allActiveUsers = await omnivault.getActiveUsers();
            let mooLp1BalanceBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            let mooLp2BalanceBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3BalanceBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            let mooLpCounter1 = 0;
            let mooLpCounter2 = 0;
            let mooLpCounter3 = 0;
            for (let i = 0; i < allActiveUsers.length; i++) {
                let balanceArrays = await omnivault.balanceOf(allActiveUsers[i]);
                let balances = balanceArrays[1];
                let vaults = balanceArrays[0];
                for (let j = 0; j < balanceArrays[0].length; j++) {
                    if (vaults[j] == mooLp1.address && Number(balances[j]) > 0) {
                        mooLpCounter1 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp2.address && Number(balances[j]) > 0) {
                        mooLpCounter2 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp3.address && Number(balances[j]) > 0) {
                        mooLpCounter3 += Number(balances[j]);
                    }
                }

            }
            expect(Number(mooLpCounter1)).to.be.closeTo(Number(mooLp1BalanceBefore), tolerance);
            expect(Number(mooLpCounter2)).to.be.closeTo(Number(mooLp2BalanceBefore), tolerance);
            expect(Number(mooLpCounter3)).to.be.closeTo(Number(mooLp3BalanceBefore), tolerance);
        })

        it("Multiple redistribution cycles and skimming should ensure that the moo lps are distributed correctly", async function () {
            await omnivault.connect(admin).setFeeOnYield(1000);
            for (let i = 0; i < 10; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
                await omnivault.connect(signers[i]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            }
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [33, 33, 33], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero])
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            await simulateIncreasedValueOfLP(mooLp2.address, ethers.utils.parseEther("10"), mooLp2.address);
            await simulateIncreasedValueOfLP(mooLp3.address, ethers.utils.parseEther("10"), mooLp3.address);

            // Skip some time to force fee skimming
            await ethers.provider.send("evm_increaseTime", [700]);
            await omnivault.skimYieldFeeAndSendToAdmin();

            let allActiveUsers = await omnivault.getActiveUsers();
            let mooLp1BalanceBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            let mooLp2BalanceBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            let mooLp3BalanceBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            let mooLpCounter1 = 0;
            let mooLpCounter2 = 0;
            let mooLpCounter3 = 0;

            for (let i = 0; i < allActiveUsers.length; i++) {
                let balanceArrays = await omnivault.balanceOf(allActiveUsers[i]);
                let balances = balanceArrays[1];
                let vaults = balanceArrays[0];
                for (let j = 0; j < balanceArrays[0].length; j++) {
                    if (vaults[j] == mooLp1.address && Number(balances[j]) > 0) {
                        mooLpCounter1 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp2.address && Number(balances[j]) > 0) {
                        mooLpCounter2 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp3.address && Number(balances[j]) > 0) {
                        mooLpCounter3 += Number(balances[j]);
                    }
                }

            }
            expect(Number(mooLpCounter1)).to.be.closeTo(Number(mooLp1BalanceBefore), tolerance);
            expect(Number(mooLpCounter2)).to.be.closeTo(Number(mooLp2BalanceBefore), tolerance);
            expect(Number(mooLpCounter3)).to.be.closeTo(Number(mooLp3BalanceBefore), tolerance);

            // Second redistribution cycle
            //
            //


            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            await simulateIncreasedValueOfLP(mooLp2.address, ethers.utils.parseEther("10"), mooLp2.address);
            await simulateIncreasedValueOfLP(mooLp3.address, ethers.utils.parseEther("10"), mooLp3.address);
            // Fee gets skimmed already here
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [10, 50, 40], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero])


            allActiveUsers = await omnivault.getActiveUsers();
            mooLp1BalanceBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            mooLp2BalanceBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            mooLp3BalanceBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            mooLpCounter1 = 0;
            mooLpCounter2 = 0;
            mooLpCounter3 = 0;

            for (let i = 0; i < allActiveUsers.length; i++) {
                let balanceArrays = await omnivault.balanceOf(allActiveUsers[i]);
                let balances = balanceArrays[1];
                let vaults = balanceArrays[0];
                for (let j = 0; j < balanceArrays[0].length; j++) {
                    if (vaults[j] == mooLp1.address && Number(balances[j]) > 0) {
                        mooLpCounter1 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp2.address && Number(balances[j]) > 0) {
                        mooLpCounter2 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp3.address && Number(balances[j]) > 0) {
                        mooLpCounter3 += Number(balances[j]);
                    }
                }

            }
            expect(Number(mooLpCounter1)).to.be.closeTo(Number(mooLp1BalanceBefore), tolerance);
            expect(Number(mooLpCounter2)).to.be.closeTo(Number(mooLp2BalanceBefore), tolerance);
            expect(Number(mooLpCounter3)).to.be.closeTo(Number(mooLp3BalanceBefore), tolerance);
            // Third redistribution cycle

            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            await simulateIncreasedValueOfLP(mooLp2.address, ethers.utils.parseEther("10"), mooLp2.address);
            await simulateIncreasedValueOfLP(mooLp3.address, ethers.utils.parseEther("10"), mooLp3.address);
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [30, 40, 30], [lp1BoostAddress, ethers.constants.AddressZero, ethers.constants.AddressZero])


            allActiveUsers = await omnivault.getActiveUsers();
            mooLp1BalanceBefore = await omnivault.getVaultBalanceOf(mooLp1.address);
            mooLp2BalanceBefore = await omnivault.getVaultBalanceOf(mooLp2.address);
            mooLp3BalanceBefore = await omnivault.getVaultBalanceOf(mooLp3.address);

            mooLpCounter1 = 0;
            mooLpCounter2 = 0;
            mooLpCounter3 = 0;
            for (let i = 0; i < allActiveUsers.length; i++) {
                let balanceArrays = await omnivault.balanceOf(allActiveUsers[i]);
                let balances = balanceArrays[1];
                let vaults = balanceArrays[0];
                for (let j = 0; j < balanceArrays[0].length; j++) {
                    if (vaults[j] == mooLp1.address && Number(balances[j]) > 0) {
                        mooLpCounter1 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp2.address && Number(balances[j]) > 0) {
                        mooLpCounter2 += Number(balances[j]);
                    }
                    if (vaults[j] == mooLp3.address && Number(balances[j]) > 0) {
                        mooLpCounter3 += Number(balances[j]);
                    }
                }

            }

            expect(Number(mooLpCounter1)).to.be.closeTo(Number(mooLp1BalanceBefore), tolerance);
            expect(Number(mooLpCounter2)).to.be.closeTo(Number(mooLp2BalanceBefore), tolerance);
            expect(Number(mooLpCounter3)).to.be.closeTo(Number(mooLp3BalanceBefore), tolerance);

        })

    })


    async function simulateIncreasedValueOfLP(vault: string, amount: BigNumber, recipient: string) {
        // Unfortunately we have not added all the underlying LPs, therefore we will use this round abotu method to get the underlying LP.
        let beefyVault = await ethers.getContractAt("IBeefyVault", vault);
        await exchange.connect(signers[5]).exchange(ethers.constants.AddressZero, vault, amount, 0, { value: amount });
        await beefyVault.connect(signers[5]).withdrawAll()
        let want = await beefyVault.want();
        let wantToken = await ethers.getContractAt("IERC20", want);
        await wantToken.connect(signers[5]).transfer(recipient, await wantToken.balanceOf(signers[5].address));
    }
})