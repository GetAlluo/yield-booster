// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBeefyVault is IERC20 {
    function deposit(uint256) external;

    function depositAll() external;

    function withdraw(uint256) external;

    function withdrawAll() external;

    function getPricePerFullShare() external view returns (uint256);

    function upgradeStrat() external;

    function balance() external view returns (uint256);

    function want() external view returns (IERC20);

    function decimals() external view returns (uint256);
}
