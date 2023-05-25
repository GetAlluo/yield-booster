// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {AlluoOmnivault} from "../AlluoOmnivault.sol";

contract AlluoOmnivaultMock is AlluoOmnivault {
    function boostIfApplicable(address vaultAddress) public {
        _boostIfApplicable(vaultAddress);
    }

    function unboostIfApplicable(address vaultAddress, uint256 amount) public {
        _unboostIfApplicable(vaultAddress, amount);
    }

    function unboostAllAndSwapRewards(
        address vaultAddress
    ) public returns (uint256) {
        return _unboostAllAndSwapRewards(vaultAddress);
    }
}
