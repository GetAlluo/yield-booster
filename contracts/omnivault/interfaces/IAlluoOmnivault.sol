// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IAlluoOmnivault {
    // Swap all tokens to  underlying beefy vault tokens by looping
    // Then initialize the user's vaultBalance
    function deposit(address tokenAddress, uint256 amount) external payable;

    // Swap all tokens to  underlying beefy vault tokens by looping through. Use the percentage.
    function withdraw(
        address tokenAddress,
        uint256 percentage
    ) external returns (uint256);
}
