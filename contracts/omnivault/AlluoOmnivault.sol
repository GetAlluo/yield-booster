// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {IAlluoOmnivault} from "./interfaces/IAlluoOmnivault.sol";
import {IExchange} from "./interfaces/IExchange.sol";
import {IBeefyBoost} from "./interfaces/IBeefyBoost.sol";
import {IBeefyVault} from "./interfaces/IBeefyVault.sol";
import {IYearnBoost} from "./interfaces/IYearnBoost.sol";
import {IYearnVault} from "./interfaces/IYearnVault.sol";
import {IWrappedEther} from "./interfaces/IWrappedEther.sol";
import {AlluoUpgradeableBase} from "../AlluoUpgradeableBase.sol";

import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "hardhat/console.sol";

contract AlluoOmnivault is AlluoUpgradeableBase, IAlluoOmnivault {
    using AddressUpgradeable for address;
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public underlyingVaultsPercents;
    mapping(address => address) public vaultToBoost;
    mapping(address => uint256) public rewardTokenToMinSwapAmount;
    mapping(address => uint256) public lastPricePerFullShare;
    mapping(address => uint256) public adminFees;

    EnumerableSetUpgradeable.AddressSet private activeUsers;
    EnumerableSetUpgradeable.AddressSet private activeUnderlyingVaults;

    IExchange public exchangeAddress;
    address public primaryToken;
    uint256 public feeOnYield;
    address public admin;
    uint256 public lastYieldSkimTimestamp;
    uint256 public skimYieldPeriod;

    IWrappedEther public constant WETH =
        IWrappedEther(0x4200000000000000000000000000000000000006);

    event BeforeRedistribution(
        address[] oldVaults,
        uint256[] oldVaultPercents,
        uint256 tvl,
        bool isSwapOneVault
    );

    event AfterRedistribution(address[] newVaults, uint256[] newVaultPercents);

    event FeeSkimmed(uint256 feeAmountAdded);

    event Deposit(address user, uint256 amount, address token);

    event Withdraw(
        address user,
        uint256 percentage,
        uint256 amount,
        address token
    );

    modifier enforceYieldSkimming() {
        if (block.timestamp >= lastYieldSkimTimestamp + skimYieldPeriod) {
            skimYieldFeeAndSendToAdmin();
        }
        _;
    }

    receive() external payable {}

    function initialize(
        address _exchangeAddress,
        address _primaryToken,
        address[] memory _underlyingVaults,
        uint256[] memory _underlyingVaultsPercents,
        address[] memory _boosts,
        address _admin,
        uint256 _feeOnYield,
        uint256 _skimYieldPeriod
    ) public initializer {
        __AlluoUpgradeableBase_init();
        exchangeAddress = IExchange(_exchangeAddress);
        primaryToken = _primaryToken;
        for (uint256 i = 0; i < _underlyingVaults.length; i++) {
            activeUnderlyingVaults.add(_underlyingVaults[i]);
            underlyingVaultsPercents[
                _underlyingVaults[i]
            ] = _underlyingVaultsPercents[i];

            lastPricePerFullShare[_underlyingVaults[i]] = getPricePerShare(
                _underlyingVaults[i]
            );
            vaultToBoost[_underlyingVaults[i]] = _boosts[i];
        }
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        admin = _admin;
        feeOnYield = _feeOnYield;
        skimYieldPeriod = _skimYieldPeriod;
        lastYieldSkimTimestamp = block.timestamp;
    }

    function getPricePerShare(
        address vaultAddress
    ) public view returns (uint256) {
        if (isBeefyVault(vaultAddress)) {
            return IBeefyVault(vaultAddress).getPricePerFullShare();
        } else {
            return IYearnVault(vaultAddress).pricePerShare();
        }
    }

    function deposit(
        address tokenAddress,
        uint256 amount
    ) external payable override enforceYieldSkimming {
        // First transfer the toknes to the contract. Then use the exchange to exchange it to the activeUnderlyingVaults
        // Then initialize the user's vaultBalance based on balance before and balance after.
        require(amount > 0, "!GT0");

        if (tokenAddress == address(0)) {
            require(msg.value == amount, "!SAME");
            WETH.deposit{value: msg.value}();
            tokenAddress = address(WETH);
        } else {
            IERC20MetadataUpgradeable(tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        _iterativeDeposit(tokenAddress, amount, true);
        if (activeUsers.contains(msg.sender) == false) {
            activeUsers.add(msg.sender);
        }
        emit Deposit(msg.sender, amount, tokenAddress);
    }

    // Only in primaryTokens
    function _iterativeDeposit(
        address token,
        uint256 amount,
        bool isDepositor
    ) internal returns (uint256[] memory) {
        uint256 remainingTokens = amount;
        uint256[] memory vaultInitialBalances = new uint256[](
            activeUnderlyingVaults.length()
        );
        IERC20MetadataUpgradeable(token).safeIncreaseAllowance(
            address(exchangeAddress),
            remainingTokens
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultPercent = underlyingVaultsPercents[vaultAddress];
            uint256 tokensToSwap = (amount * vaultPercent) / 100;
            vaultInitialBalances[i] = getVaultBalanceOf(vaultAddress);
            if (i == activeUnderlyingVaults.length() - 1) {
                tokensToSwap = remainingTokens;
            } else {
                remainingTokens -= tokensToSwap;
            }

            uint256 newVaultTokens = exchangeAddress.exchange(
                token,
                vaultAddress,
                tokensToSwap,
                0
            );
            _boostIfApplicable(vaultAddress);
            if (isDepositor) {
                balances[msg.sender][vaultAddress] += newVaultTokens;
            }
        }
        return vaultInitialBalances;
    }

    function _boostIfApplicable(address vaultAddress) internal virtual {
        address boostAddress = vaultToBoost[vaultAddress];
        IERC20MetadataUpgradeable vaultToken = IERC20MetadataUpgradeable(
            vaultAddress
        );
        if (boostAddress != address(0)) {
            vaultToken.safeIncreaseAllowance(
                boostAddress,
                vaultToken.balanceOf(address(this))
            );
            if (isBeefyVault(vaultAddress)) {
                IBeefyBoost(boostAddress).stake(
                    vaultToken.balanceOf(address(this))
                );
            } else {
                IYearnBoost(boostAddress).stake(
                    vaultToken.balanceOf(address(this))
                );
            }
        }
    }

    function withdraw(
        address tokenAddress,
        uint256 percentage
    ) external override enforceYieldSkimming returns (uint256 totalTokens) {
        require(percentage > 0, "!GT0");
        require(percentage <= 100, "!LTE100");
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 vaultAmount = (balances[msg.sender][vaultAddress] *
                percentage) / 100;
            // If the vault token is inside the beefy boost, exit that first

            _unboostIfApplicable(vaultAddress, vaultAmount);
            IERC20MetadataUpgradeable(vaultAddress).safeIncreaseAllowance(
                address(exchangeAddress),
                vaultAmount
            );
            totalTokens += exchangeAddress.exchange(
                vaultAddress,
                primaryToken,
                vaultAmount,
                0
            );
            balances[msg.sender][vaultAddress] -= vaultAmount;
        }

        if (percentage == 100) {
            activeUsers.remove(msg.sender);
        }

        if (tokenAddress != primaryToken) {
            if (tokenAddress == address(0) && primaryToken == address(WETH)) {
                WETH.withdraw(totalTokens);
            } else {
                IERC20MetadataUpgradeable(primaryToken).safeIncreaseAllowance(
                    address(exchangeAddress),
                    totalTokens
                );

                totalTokens = exchangeAddress.exchange(
                    primaryToken,
                    tokenAddress,
                    totalTokens,
                    0
                );
            }
        }
        if (tokenAddress == address(0)) {
            payable(msg.sender).transfer(totalTokens);
        } else {
            IERC20MetadataUpgradeable(tokenAddress).safeTransfer(
                msg.sender,
                totalTokens
            );
        }

        emit Withdraw(msg.sender, percentage, totalTokens, tokenAddress);
    }

    function skimYieldFeeAndSendToAdmin() public {
        if (feeOnYield == 0) {
            return;
        }

        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 currentPricePerFullShare = getPricePerShare(vaultAddress);
            uint256 previousPricePerFullShare = lastPricePerFullShare[
                vaultAddress
            ];

            console.log("currentPricePerFullShare", currentPricePerFullShare);
            console.log("previousPricePerFullShare", previousPricePerFullShare);
            if (currentPricePerFullShare > previousPricePerFullShare) {
                // Additional yield from reward tokens, only in the LP.
                uint256 additionalYield = ((currentPricePerFullShare -
                    previousPricePerFullShare) *
                    getVaultBalanceOf(vaultAddress));

                uint256 feeInUnderlyingToken = (additionalYield * feeOnYield) /
                    10000;
                uint256 lpTokensToWithdraw = feeInUnderlyingToken /
                    currentPricePerFullShare;
                console.log("Additional yield", additionalYield);
                console.log("Fee in underlying token", feeInUnderlyingToken);
                console.log("Lp tokens to withdraw", lpTokensToWithdraw);

                if (lpTokensToWithdraw == 0) {
                    // No additional yield
                    console.log("No additional yield");
                    continue;
                }
                IERC20MetadataUpgradeable(vaultAddress).safeIncreaseAllowance(
                    address(exchangeAddress),
                    lpTokensToWithdraw
                );
                if (vaultToBoost[vaultAddress] != address(0)) {
                    if (isBeefyVault(vaultAddress)) {
                        IBeefyBoost(vaultToBoost[vaultAddress]).withdraw(
                            lpTokensToWithdraw
                        );
                    } else {
                        IYearnBoost(vaultToBoost[vaultAddress]).withdraw(
                            lpTokensToWithdraw
                        );
                    }
                }
                uint256 feeInPrimaryToken = exchangeAddress.exchange(
                    vaultAddress,
                    primaryToken,
                    lpTokensToWithdraw,
                    0
                );

                // Update admin fees mapping
                adminFees[primaryToken] += feeInPrimaryToken;
                emit FeeSkimmed(feeInPrimaryToken);

                // Update user balances
                for (uint256 j = 0; j < activeUsers.length(); j++) {
                    address userAddress = activeUsers.at(j);
                    uint256 userBalance = balances[userAddress][vaultAddress];
                    uint256 userShareBeforeSwap = (userBalance * 1e18) /
                        (getVaultBalanceOf(vaultAddress) + lpTokensToWithdraw);
                    uint256 userLpFee = (lpTokensToWithdraw *
                        userShareBeforeSwap) / 1e18;
                    console.log("User balance", userBalance);
                    console.log("User share before swap", userShareBeforeSwap);
                    console.log("User lp fee", userLpFee);
                    console.log("New balance", userBalance - userLpFee);
                    balances[userAddress][vaultAddress] =
                        userBalance -
                        userLpFee;
                }
            }
        }

        _updateLastPricePerFullShare();
    }

    function _updateLastPricePerFullShare() internal {
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 currentPricePerFullShare = getPricePerShare(vaultAddress);
            lastPricePerFullShare[vaultAddress] = currentPricePerFullShare;
        }
    }

    function _processBoostReward(
        address boostAddress,
        address rewardToken
    ) internal returns (uint256 rewardAmount) {
        if (boostAddress != address(0)) {
            uint256 rewardBalance = IERC20MetadataUpgradeable(rewardToken)
                .balanceOf(address(this));
            if (rewardBalance < rewardTokenToMinSwapAmount[rewardToken]) {
                return 0;
            }
            IERC20MetadataUpgradeable(rewardToken).safeIncreaseAllowance(
                address(exchangeAddress),
                rewardBalance
            );

            rewardAmount = exchangeAddress.exchange(
                rewardToken,
                primaryToken,
                rewardBalance,
                0
            );
            uint256 fee = (rewardAmount * feeOnYield) / 10000;
            rewardAmount -= fee;
            adminFees[primaryToken] += fee;
        }
    }

    function _swapBoostedRewards() internal returns (uint256) {
        uint256 totalRewards;
        for (uint256 i; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            address boostAddress = vaultToBoost[vaultAddress];
            address rewardToken;
            if (boostAddress != address(0)) {
                if (isBeefyVault(vaultAddress)) {
                    IBeefyBoost(boostAddress).getReward();
                    rewardToken = IBeefyBoost(boostAddress).rewardToken();
                } else {
                    IYearnBoost(boostAddress).getReward();
                    rewardToken = IYearnBoost(boostAddress).rewardsToken();
                }
            }
            totalRewards += _processBoostReward(boostAddress, rewardToken);
        }
        return totalRewards;
    }

    function _unboostIfApplicable(
        address vaultAddress,
        uint256 amount
    ) internal virtual {
        address boostAddress = vaultToBoost[vaultAddress];
        if (boostAddress != address(0)) {
            if (isBeefyVault(vaultAddress)) {
                IBeefyBoost(boostAddress).withdraw(amount);
            } else {
                IYearnBoost(boostAddress).withdraw(amount);
            }
        }
    }

    function _unboostAllAndSwapRewards(
        address vaultAddress
    ) internal virtual returns (uint256) {
        address boostAddress = vaultToBoost[vaultAddress];
        address rewardToken;
        if (boostAddress != address(0)) {
            if (isBeefyVault(vaultAddress)) {
                IBeefyBoost(boostAddress).exit();
                rewardToken = IBeefyBoost(boostAddress).rewardToken();
            } else {
                IYearnBoost(boostAddress).exit();
                rewardToken = IYearnBoost(boostAddress).rewardsToken();
            }
        }
        return _processBoostReward(boostAddress, rewardToken);
    }

    function _harvestAndCreditUsers() internal {
        uint256 boostedRewards = _swapBoostedRewards();
        if (boostedRewards > 0) {
            uint256[] memory _vaultInitialBalances = _iterativeDeposit(
                primaryToken,
                boostedRewards,
                false
            );
            for (uint256 j = 0; j < activeUnderlyingVaults.length(); j++) {
                address vaultAddress = activeUnderlyingVaults.at(j);
                uint256 vaultBalance = getVaultBalanceOf(vaultAddress);

                for (uint256 i = 0; i < activeUsers.length(); i++) {
                    address user = activeUsers.at(i);
                    uint256 userVaultBalance = balances[user][vaultAddress];
                    uint256 vaultPercentage = (userVaultBalance * 1e18) /
                        _vaultInitialBalances[j];
                    uint256 newUserVaultTokens = (vaultBalance *
                        vaultPercentage) / 1e18;
                    console.log("User vault balance", userVaultBalance);
                    console.log("Vault percentage", vaultPercentage);
                    console.log("Vault balance", vaultBalance);
                    console.log("New user vault tokens", newUserVaultTokens);
                    balances[user][vaultAddress] = newUserVaultTokens;
                }
            }
        }
    }

    function swapOneVault(
        address oldVault,
        address[] memory newVaults,
        uint256[] memory newPercents,
        address[] memory boostVaults
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        skimYieldFeeAndSendToAdmin();

        // Step 1: Swap each of the omnivault's tokens to the primary token and note down.

        uint256 primaryTokens = _unboostAllAndSwapRewards(oldVault);

        uint256 vaultInitialBalance = getVaultBalanceOf(oldVault);
        IERC20MetadataUpgradeable(oldVault).safeIncreaseAllowance(
            address(exchangeAddress),
            vaultInitialBalance
        );
        primaryTokens += exchangeAddress.exchange(
            oldVault,
            primaryToken,
            vaultInitialBalance,
            0
        );

        emit BeforeRedistribution(
            getActiveUnderlyingVaults(),
            getUnderlyingVaultsPercents(),
            primaryTokens,
            true
        );

        // Step 2: Swap all of these primary tokens to the correct proportion of new moo tokens.
        uint256 remainingPrimaryTokens = primaryTokens;
        IERC20MetadataUpgradeable(primaryToken).safeIncreaseAllowance(
            address(exchangeAddress),
            remainingPrimaryTokens
        );

        uint256[] memory newVaultBalances = new uint256[](newVaults.length);

        for (uint256 i = 0; i < newVaults.length; i++) {
            uint256 percent = newPercents[i];
            uint256 primaryTokensToSwap = (primaryTokens * percent) / 100;
            if (i == newVaults.length - 1) {
                primaryTokensToSwap = remainingPrimaryTokens;
            } else {
                remainingPrimaryTokens -= primaryTokensToSwap;
            }
            // These new vault balances are INCREMENTAL new vault balances from the swap
            newVaultBalances[i] = exchangeAddress.exchange(
                primaryToken,
                newVaults[i],
                primaryTokensToSwap,
                0
            );
        }
        // Step 3: Loop through every user and calculate how much new vault tokens they are entitled to.

        for (uint256 i = 0; i < activeUsers.length(); i++) {
            address user = activeUsers.at(i);
            uint256 userVaultBalance = balances[user][oldVault];
            uint256 vaultPercentage = (userVaultBalance * 1e18) /
                vaultInitialBalance;
            uint256 userPrimaryTokens = (primaryTokens * vaultPercentage) /
                1e18;
            console.log("Vault Address", oldVault);
            console.log("User vault balance", userVaultBalance);
            console.log("Vault percentage", vaultPercentage);
            console.log("Primary tokens", primaryTokens);
            console.log("User primary tokens", userPrimaryTokens);
            delete balances[user][oldVault];

            uint256 userPercentage = (userPrimaryTokens * 1e18) / primaryTokens;
            // This is how much of the new swaps he owns.
            console.log("User percentage", userPercentage);

            for (uint256 j = 0; j < newVaults.length; j++) {
                address newVaultAddress = newVaults[j];
                // How much of the incremental new vault tokens the user owns
                uint256 newUserVaultTokens = (newVaultBalances[j] *
                    userPercentage) / 1e18;
                console.log("New vault balance", newVaultBalances[j]);
                console.log("New user vault tokens", newUserVaultTokens);
                balances[user][newVaultAddress] += newUserVaultTokens;
            }
        }

        // Step 4: Update state variables and remove old vault balance values.

        activeUnderlyingVaults.remove(oldVault);
        uint256 oldVaultPercentage = underlyingVaultsPercents[oldVault];
        underlyingVaultsPercents[oldVault] = 0;

        for (uint256 i = 0; i < newVaults.length; i++) {
            address newVaultAddress = newVaults[i];
            if (!activeUnderlyingVaults.contains(newVaultAddress)) {
                activeUnderlyingVaults.add(newVaultAddress);
            }
            underlyingVaultsPercents[newVaultAddress] +=
                (newPercents[i] * oldVaultPercentage) /
                100;
            if (boostVaults[i] != address(0)) {
                vaultToBoost[newVaultAddress] = boostVaults[i];
            }
            lastPricePerFullShare[newVaults[i]] = getPricePerShare(
                newVaults[i]
            );
            _boostIfApplicable(newVaultAddress);
        }

        emit AfterRedistribution(
            getActiveUnderlyingVaults(),
            getUnderlyingVaultsPercents()
        );
    }

    function redistribute(
        address[] memory newVaults,
        uint256[] memory newPercents,
        address[] memory boostVaults
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newVaults.length == newPercents.length,
            "Mismatch in vaults and percents lengths"
        );
        skimYieldFeeAndSendToAdmin();
        if (newVaults.length == 0) {
            _harvestAndCreditUsers();
            return;
        }

        // Step 1: Swap each of the omnivault's tokens to the primary token and note down.
        uint256 totalPrimaryTokens;
        uint256[] memory primaryTokensList = new uint256[](
            activeUnderlyingVaults.length()
        );
        uint256[] memory vaultInitialBalances = new uint256[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            uint256 primaryTokens = _unboostAllAndSwapRewards(vaultAddress);

            uint256 vaultBalance = getVaultBalanceOf(vaultAddress);
            vaultInitialBalances[i] = vaultBalance;
            IERC20MetadataUpgradeable(vaultAddress).safeIncreaseAllowance(
                address(exchangeAddress),
                vaultBalance
            );
            primaryTokens += exchangeAddress.exchange(
                vaultAddress,
                primaryToken,
                vaultBalance,
                0
            );
            totalPrimaryTokens += primaryTokens;
            primaryTokensList[i] = primaryTokens;
        }

        emit BeforeRedistribution(
            getActiveUnderlyingVaults(),
            getUnderlyingVaultsPercents(),
            totalPrimaryTokens,
            false
        );

        // Step 2: Swap all of these primary tokens to the correct proportion of new moo tokens.
        uint256 remainingPrimaryTokens = totalPrimaryTokens;
        IERC20MetadataUpgradeable(primaryToken).safeIncreaseAllowance(
            address(exchangeAddress),
            remainingPrimaryTokens
        );
        for (uint256 i = 0; i < newVaults.length; i++) {
            uint256 percent = newPercents[i];
            uint256 primaryTokensToSwap = (totalPrimaryTokens * percent) / 100;
            if (i == newVaults.length - 1) {
                primaryTokensToSwap = remainingPrimaryTokens;
            } else {
                remainingPrimaryTokens -= primaryTokensToSwap;
            }
            exchangeAddress.exchange(
                primaryToken,
                newVaults[i],
                primaryTokensToSwap,
                0
            );
        }
        // Step 3: Loop through every user and calculate how much new vault tokens they are entitled to.
        uint256[] memory newVaultBalances = new uint256[](newVaults.length);

        for (uint256 j = 0; j < newVaults.length; j++) {
            newVaultBalances[j] = getVaultBalanceOf(newVaults[j]);
        }

        for (uint256 i = 0; i < activeUsers.length(); i++) {
            address user = activeUsers.at(i);
            uint256 userTotalPrimaryTokens;
            for (uint256 j = 0; j < activeUnderlyingVaults.length(); j++) {
                address vaultAddress = activeUnderlyingVaults.at(j);
                uint256 userVaultBalance = balances[user][vaultAddress];
                uint256 vaultPercentage = (userVaultBalance * 1e18) /
                    vaultInitialBalances[j];
                uint256 userPrimaryTokens = (primaryTokensList[j] *
                    vaultPercentage) / 1e18;
                console.log("Vault Address", vaultAddress);
                console.log("User vault balance", userVaultBalance);
                console.log("Vault percentage", vaultPercentage);
                console.log("Primary tokens", primaryTokensList[j]);
                console.log("User primary tokens", userPrimaryTokens);
                userTotalPrimaryTokens += userPrimaryTokens;
                delete balances[user][vaultAddress];
            }

            uint256 userPercentage = (userTotalPrimaryTokens * 1e18) /
                totalPrimaryTokens;
            console.log("User percentage", userPercentage);

            for (uint256 j = 0; j < newVaults.length; j++) {
                address newVaultAddress = newVaults[j];
                uint256 newUserVaultTokens = (newVaultBalances[j] *
                    userPercentage) / 1e18;
                console.log("New vault balance", newVaultBalances[j]);
                console.log("New user vault tokens", newUserVaultTokens);
                balances[user][newVaultAddress] = newUserVaultTokens;
            }
        }

        // Step 4: Update state variables and remove old vault balance values.
        address[] memory _activeUnderlyingVaults = activeUnderlyingVaults
            .values();
        for (uint256 i = 0; i < _activeUnderlyingVaults.length; i++) {
            address vaultAddress = _activeUnderlyingVaults[i];
            activeUnderlyingVaults.remove(vaultAddress);
            underlyingVaultsPercents[vaultAddress] = 0;
        }

        for (uint256 i = 0; i < newVaults.length; i++) {
            address newVaultAddress = newVaults[i];
            activeUnderlyingVaults.add(newVaultAddress);
            underlyingVaultsPercents[newVaultAddress] = newPercents[i];
            if (boostVaults[i] != address(0)) {
                vaultToBoost[newVaultAddress] = boostVaults[i];
            }
            lastPricePerFullShare[newVaults[i]] = getPricePerShare(
                newVaults[i]
            );
            _boostIfApplicable(newVaultAddress);
        }

        emit AfterRedistribution(
            getActiveUnderlyingVaults(),
            getUnderlyingVaultsPercents()
        );
    }

    function claimAdminFees()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256)
    {
        uint256 feeAmount = adminFees[primaryToken];
        require(feeAmount > 0, "NO_FEES");
        adminFees[primaryToken] = 0;
        IERC20MetadataUpgradeable(primaryToken).safeTransfer(
            msg.sender,
            feeAmount
        );
        return feeAmount;
    }

    function getVaultBalanceOf(
        address vaultAddress
    ) public view returns (uint256 total) {
        total += IERC20MetadataUpgradeable(vaultAddress).balanceOf(
            address(this)
        );
        if (vaultToBoost[vaultAddress] != address(0)) {
            if (isBeefyVault(vaultAddress)) {
                total += IBeefyBoost(vaultToBoost[vaultAddress]).balanceOf(
                    address(this)
                );
            } else {
                total += IYearnBoost(vaultToBoost[vaultAddress]).balanceOf(
                    address(this)
                );
            }
        }
    }

    function isBeefyVault(address vaultAddress) public view returns (bool) {
        try IBeefyVault(vaultAddress).getPricePerFullShare() returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }

    // Return the balance of a user in a vault by looping through the active vaults
    function balanceOf(
        address user
    )
        external
        view
        returns (address[] memory vaults, uint256[] memory vaultBalances)
    {
        vaults = new address[](activeUnderlyingVaults.length());
        vaultBalances = new uint256[](activeUnderlyingVaults.length());
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            vaults[i] = vaultAddress;
            vaultBalances[i] = balances[user][vaultAddress];
        }
    }

    function getActiveUnderlyingVaults()
        public
        view
        returns (address[] memory)
    {
        address[] memory vaults = new address[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            vaults[i] = activeUnderlyingVaults.at(i);
        }
        return vaults;
    }

    function getUnderlyingVaultsPercents()
        public
        view
        returns (uint256[] memory)
    {
        uint256[] memory percents = new uint256[](
            activeUnderlyingVaults.length()
        );
        for (uint256 i = 0; i < activeUnderlyingVaults.length(); i++) {
            address vaultAddress = activeUnderlyingVaults.at(i);
            percents[i] = underlyingVaultsPercents[vaultAddress];
        }
        return percents;
    }

    function getActiveUsers() external view returns (address[] memory) {
        address[] memory users = new address[](activeUsers.length());
        for (uint256 i = 0; i < activeUsers.length(); i++) {
            users[i] = activeUsers.at(i);
        }
        return users;
    }

    // Admin functions
    function setExchangeAddress(
        address _exchangeAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        exchangeAddress = IExchange(_exchangeAddress);
    }

    function setPrimaryToken(
        address _primaryToken
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        primaryToken = _primaryToken;
    }

    function setFeeOnYield(
        uint256 _feeOnYield
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeOnYield = _feeOnYield;
    }

    function setSkimYieldPeriod(
        uint256 _skimYieldPeriod
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        skimYieldPeriod = _skimYieldPeriod;
    }

    function setBoostVault(
        address _vault,
        address _boostVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultToBoost[_vault] = _boostVault;
    }

    function setRewardTokenToMinSwapAmount(
        address _rewardToken,
        uint256 _minAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardTokenToMinSwapAmount[_rewardToken] = _minAmount;
    }

    function removeActiveUnderlyingVault(
        address _vaultAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        activeUnderlyingVaults.remove(_vaultAddress);
        underlyingVaultsPercents[_vaultAddress] = 0;
    }
}
