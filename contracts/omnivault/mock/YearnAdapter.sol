// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/IYearnVault.sol";
import "hardhat/console.sol";

interface IExchangeAdapter {
    // 0x6012856e  =>  executeSwap(address,address,address,uint256)
    function executeSwap(
        address pool,
        address fromToken,
        address toToken,
        uint256 amount
    ) external payable returns (uint256);

    // 0x73ec962e  =>  enterPool(address,address,uint256)
    function enterPool(
        address pool,
        address fromToken,
        uint256 amount
    ) external payable returns (uint256);

    // 0x660cb8d4  =>  exitPool(address,address,uint256)
    function exitPool(
        address pool,
        address toToken,
        uint256 amount
    ) external payable returns (uint256);
}

contract YearnAdapter is IExchangeAdapter {
    address public constant USDC = 0x7F5c764cBc14f9669B88837ca1490cCa17c31607;
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    address public constant USDT = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;

    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant OP = 0x4200000000000000000000000000000000000042;

    // 0x6012856e  =>  executeSwap(address,address,address,uint256)
    function executeSwap(
        address pool,
        address fromToken,
        address toToken,
        uint256 amount
    ) external payable returns (uint256) {
        if (
            fromToken == USDC ||
            fromToken == DAI ||
            fromToken == USDT ||
            fromToken == WETH ||
            fromToken == OP
        ) {
            return IYearnVault(pool).deposit(amount);
        } else if (
            toToken == USDC ||
            toToken == DAI ||
            toToken == USDT ||
            toToken == WETH ||
            toToken == OP
        ) {
            return IYearnVault(pool).withdraw(amount);
        } else {
            revert("Adapter: can't swap");
        }
    }

    // 0xe83bbb76  =>  enterPool(address,address,address,uint256)
    function enterPool(
        address,
        address,
        uint256
    ) external payable returns (uint256) {
        revert("Adapter: can't enter");
    }

    // 0x9d756192  =>  exitPool(address,address,address,uint256)
    function exitPool(
        address,
        address,
        uint256
    ) external payable returns (uint256) {
        revert("Adapter: can't exit");
    }
}
