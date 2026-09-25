// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

import {PermissionedRegistry} from "~src/registry/PermissionedRegistry.sol";
import {UserRegistry} from "~src/registry/UserRegistry.sol";
import {IPermissionedRegistry} from "~src/registry/interfaces/IPermissionedRegistry.sol";
import {RegistryRolesLib} from "~src/registry/libraries/RegistryRolesLib.sol";
import {LibLabel} from "~src/utils/LibLabel.sol";
import {IExtendedResolver} from "@ens/contracts/resolvers/profiles/IExtendedResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";

/// @notice Checks that the pinned ENSv2 Beta sources compile with our remappings
///         and that the role constants we depend on have the expected layout.
contract SmokeTest is Test {
    function test_betaSourcesCompile() public pure {
        assertEq(RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, (uint256(1) << 28) << 128);
        assertEq(LibLabel.withVersion(LibLabel.id("nafuda"), 0), LibLabel.id("nafuda") & ~uint256(type(uint32).max));
        assertEq(type(IExtendedResolver).interfaceId, IExtendedResolver.resolve.selector);
    }
}
