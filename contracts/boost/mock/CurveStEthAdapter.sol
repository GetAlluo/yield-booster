// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IWrappedEther {
    function name() external view returns (string memory);

    function approve(address guy, uint256 wad) external returns (bool);

    function totalSupply() external view returns (uint256);

    function transferFrom(
        address src,
        address dst,
        uint256 wad
    ) external returns (bool);

    function withdraw(uint256 wad) external;

    function decimals() external view returns (uint8);

    function balanceOf(address) external view returns (uint256);

    function symbol() external view returns (string memory);

    function transfer(address dst, uint256 wad) external returns (bool);

    function deposit() external payable;

    function allowance(address, address) external view returns (uint256);
}

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

// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase
interface ICurveStEth {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external payable returns (uint256);

    function add_liquidity(
        uint256[2] memory _amounts,
        uint256 _min_mint_amount
    ) external payable returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 i,
        uint256 _min_received
    ) external returns (uint256);
}

contract CurveStEthAdapter is IExchangeAdapter {
    address public constant StEthEthLp =
        0x06325440D014e39736583c165C2963BA99fAf14E;
    ICurveStEth public constant StEthPool =
        ICurveStEth(0xDC24316b9AE028F1497c275EB9192a3Ea0f67022);

    function indexByCoin(address coin) public pure returns (int128) {
        if (coin == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) return 1; // native ETH
        if (coin == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) return 2; // StEth
        return 0;
    }

    // 0x6012856e  =>  executeSwap(address,address,address,uint256)
    function executeSwap(
        address pool,
        address fromToken,
        address toToken,
        uint256 amount
    ) external payable returns (uint256) {
        ICurveStEth curve = ICurveStEth(pool);
        if (toToken == StEthEthLp) {
            uint128 i = uint128(indexByCoin(fromToken));
            require(i != 0, "CurveStEthAdapter: Can't Swap");
            if (i == 1) {
                IWrappedEther(fromToken).withdraw(amount);
            }
            uint256[2] memory entryVector;
            entryVector[i - 1] = amount;
            return curve.add_liquidity{value: amount}(entryVector, 0);
        } else if (fromToken == StEthEthLp) {
            int128 i = indexByCoin(toToken);
            require(i != 0, "CurveStEthAdapter: Can't Swap");
            uint256 amount = curve.remove_liquidity_one_coin(amount, i - 1, 0);
            if (i == 1) {
                IWrappedEther(toToken).deposit{value: amount}();
            }
            return amount;
        } else {
            revert("CurveStEthAdapter: Can't Swap");
        }
    }

    // 0xe83bbb76  =>  enterPool(address,address,address,uint256)
    function enterPool(
        address,
        address,
        uint256
    ) external payable returns (uint256) {
        revert("CurveStEthAdapter: Can't Swap");
    }

    // 0x9d756192  =>  exitPool(address,address,address,uint256)
    function exitPool(
        address,
        address,
        uint256
    ) external payable returns (uint256) {
        revert("CurveStEthAdapter: Can't Swap");
    }
}
