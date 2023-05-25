// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IBeefyBoost {
    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function exit() external;

    function balanceOf(address account) external view returns (uint256);

    function getReward() external;

    function rewardToken() external view returns (address);
}
