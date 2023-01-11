import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { before } from "mocha";
import {
  AlluoYieldResolver,
  IERC20MetadataUpgradeable,
  Exchange,
} from "../typechain";

describe("Alluo Yield Resolver Tests", function () {
  let gnosis: SignerWithAddress;
  let signers: SignerWithAddress[];
  let resolver: AlluoYieldResolver;
  let exchange: Exchange;
  let usdc: IERC20MetadataUpgradeable;
  const ZERO_ADDR = ethers.constants.AddressZero;

  async function getImpersonatedSigner(
    address: string
  ): Promise<SignerWithAddress> {
    await ethers.provider.send("hardhat_impersonateAccount", [address]);

    return await ethers.getSigner(address);
  }

  async function skipDays(d: number) {
    ethers.provider.send("evm_increaseTime", [d * 86400]);
    ethers.provider.send("evm_mine", []);
  }

  async function grantRoleToPool() {
    const pool = await ethers.getContractAt(
      "AlluoVaultPool",
      "0x470e486acA0e215C925ddcc3A9D446735AabB714"
    );

    await pool
      .connect(gnosis)
      .grantRole(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        resolver.address
      );
  }

  async function getTxFromExecPayload(txCheckerPayload: string) {
    const data = txCheckerPayload;
    const tx = {
      from: signers[0].address,
      to: resolver.address,
      data: data,
    };
    return tx;
  }

  async function depositUSDCtoAlluoVault(vaultAddress: string) {
    const vault = await ethers.getContractAt(
      "AlluoVaultUpgradeable",
      vaultAddress
    );
    const usdcBalance = parseUnits("100", 6);
    await usdc.approve(vault.address, ethers.constants.MaxUint256);
    await vault.depositWithoutLP(usdcBalance, usdc.address);
  }

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            enabled: true,
            jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
            //you can fork from last block by commenting next line
            blockNumber: 15825177,
          },
        },
      ],
    });
  });

  before(async () => {
    signers = await ethers.getSigners();

    exchange = await ethers.getContractAt(
      "Exchange",
      "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec"
    );
    usdc = await ethers.getContractAt(
      "IERC20MetadataUpgradeable",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );

    const value = parseEther("2000.0");
    await exchange.exchange(ZERO_ADDR, usdc.address, value, 0, {
      value: value,
    });
  });

  beforeEach(async () => {
    gnosis = await getImpersonatedSigner(
      "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"
    );
    await signers[0].sendTransaction({
      to: gnosis.address,
      value: parseEther("100"),
    });

    let maxGas = 15 * 10 ** 9;
    let stakeTime = 86400;
    let farmTime = 86400 * 7;
    const alluoVault = [
      "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b",
      "0x7417e7d4369090FC49C43789116efC34c52b2D98",
      "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271",
    ];
    const alluoPool = ["0x470e486acA0e215C925ddcc3A9D446735AabB714"];

    let AlluoYieldResolverFactory = await ethers.getContractFactory(
      "AlluoYieldResolver"
    );
    resolver = await AlluoYieldResolverFactory.deploy(
      maxGas,
      stakeTime,
      farmTime,
      alluoVault,
      alluoPool,
      gnosis.address
    );

    await resolver
      .connect(gnosis)
      .grantRole(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        signers[0].address
      );
  });

  describe("Daily Staking tests", function () {
    it("Verify checker conditions and return true", async function () {
      const vaultAddress = "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b";
      await depositUSDCtoAlluoVault(vaultAddress);

      expect((await resolver.stakingChecker()).canExec).equal(true);

      const data = (await resolver.stakingChecker()).execPayload;
      const tx = await getTxFromExecPayload(data);
      await signers[0].sendTransaction(tx);
    });

    it("Verify checker conditions and fail on balance", async function () {
      expect((await resolver.stakingChecker()).canExec).equal(false);
    });

    it("Verify checker conditions and fail on gas", async function () {
      const vaultAddress = "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b";
      await depositUSDCtoAlluoVault(vaultAddress);

      expect((await resolver.stakingChecker()).canExec).equal(true);

      await resolver.connect(gnosis).setMaxGas(12 * 10 ** 9);
      expect((await resolver.stakingChecker()).canExec).equal(false);
    });

    it("Stake funds and verify checker conditions on timestamp", async function () {
      const vaultAddress = "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b";
      await depositUSDCtoAlluoVault(vaultAddress);

      expect((await resolver.stakingChecker()).canExec).equal(true);

      const data = (await resolver.stakingChecker()).execPayload;
      const tx = await getTxFromExecPayload(data);
      await signers[0].sendTransaction(tx);

      await depositUSDCtoAlluoVault(vaultAddress);
      expect((await resolver.stakingChecker()).canExec).equal(false);

      await skipDays(1);
      expect((await resolver.stakingChecker()).canExec).equal(true);
    });

    it("Stake funds and verify checker conditions on balance", async function () {
      const vaultAddress = "0x2D182Fc86Cd4C38D9FE94566251A6aF1A85F784b";
      await depositUSDCtoAlluoVault(vaultAddress);

      expect((await resolver.stakingChecker()).canExec).equal(true);

      const data = (await resolver.stakingChecker()).execPayload;
      const tx = await getTxFromExecPayload(data);
      await signers[0].sendTransaction(tx);

      await skipDays(0.5);
      expect((await resolver.stakingChecker()).canExec).equal(false);

      await skipDays(0.5);
      await depositUSDCtoAlluoVault(vaultAddress);
      expect((await resolver.stakingChecker()).canExec).equal(true);
    });
  });

  describe("Weekly Farming tests", function () {
    it("Verify checker conditions and return true", async function () {
      await grantRoleToPool();

      expect((await resolver.farmingChecker()).canExec).equal(true);

      const data = (await resolver.farmingChecker()).execPayload;
      const tx = await getTxFromExecPayload(data);
      await signers[0].sendTransaction(tx);
    });

    it("Verify checker conditions and fail on gas", async function () {
      expect((await resolver.farmingChecker()).canExec).equal(true);

      await resolver.connect(gnosis).setMaxGas(12 * 10 ** 9);
      expect((await resolver.farmingChecker()).canExec).equal(false);
    });

    it("Farm funds and verify checker conditions on timestamp", async function () {
      await grantRoleToPool();

      expect((await resolver.farmingChecker()).canExec).equal(true);
      console.log('here 1');

      const data = (await resolver.farmingChecker()).execPayload;
      console.log('here 2', data);
      const tx = await getTxFromExecPayload(data);
      console.log('here 2.1', tx);
      await signers[0].sendTransaction(tx);

      await skipDays(6);
      console.log('here 3');
      expect((await resolver.farmingChecker()).canExec).equal(false);

      await skipDays(1);
      console.log('here 4');
      expect((await resolver.farmingChecker()).canExec).equal(true);
    });
  });

  describe("Set functions", function () {
    it("Verify stakeTime was updated", async function () {
      expect(await resolver.stakeTime()).equal(86400);
      await resolver.connect(gnosis).setStakeTime(10000);
      expect(await resolver.stakeTime()).equal(10000);
    });

    it("Verify farmTime was updated", async function () {
      expect(await resolver.farmTime()).equal(86400 * 7);
      await resolver.connect(gnosis).setFarmTime(10000 * 7);
      expect(await resolver.farmTime()).equal(10000 * 7);
    });

    it("Verify maxGas was updated", async function () {
      expect(await resolver.maxGas()).equal(15 * 10 ** 9);
      await resolver.connect(gnosis).setMaxGas(10 * 10 ** 9);
      expect(await resolver.maxGas()).equal(10 * 10 ** 9);
    });
  });
});
