// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {ITextResolver} from "@ens/contracts/resolvers/profiles/ITextResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {V2Fixture} from "~test/fixtures/V2Fixture.sol";
import {Grant} from "~src/access-control/interfaces/IEACGrantInitializable.sol";
import {EACBaseRolesLib} from "~src/access-control/libraries/EACBaseRolesLib.sol";
import {RegistryRolesLib} from "~src/registry/libraries/RegistryRolesLib.sol";
import {UserRegistry} from "~src/registry/UserRegistry.sol";
import {LibLabel} from "~src/utils/LibLabel.sol";

import {TitleControllerV2} from "../src/TitleControllerV2.sol";

/// @notice TitleControllerV2: everything TitleController does (spot-checked here; the full
///         behaviour is covered by TitleController.t.sol), plus grader-defined attributes.
///
///   bgs-sim.nafuda.eth   grader registry with TitleControllerV2 as its wildcard resolver
contract TitleControllerV2Test is V2Fixture {
    string constant GRADER_NAME = "BGS-Sim (simulated grader modeled after Beckett Grading Services; not affiliated with Beckett)";
    string constant CERT = "1004827301";
    string constant CARD = "Ryujin Pearl - Secret #007 (demo card)";
    string constant GRADE = "GEM MINT 9.5";

    uint256 constant GRADER_FINAL_ROOT_ROLES =
        RegistryRolesLib.ROLE_REGISTRAR_ADMIN |
        RegistryRolesLib.ROLE_SET_PARENT |
        RegistryRolesLib.ROLE_SET_PARENT_ADMIN |
        RegistryRolesLib.ROLE_CAN_NAME |
        RegistryRolesLib.ROLE_CAN_NAME_ADMIN;

    uint256 constant ETH_TOKEN_ROLES =
        RegistryRolesLib.ROLE_SET_SUBREGISTRY |
        RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN |
        RegistryRolesLib.ROLE_SET_RESOLVER |
        RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN |
        RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;

    address operator = makeAddr("operator");
    address grader = makeAddr("grader");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address chip = makeAddr("chip");

    UserRegistry nafudaRegistry;
    UserRegistry bgsRegistry;
    TitleControllerV2 controller;

    function setUp() public {
        deployV2Fixture();
        UserRegistry impl = new UserRegistry(labelStore, address(this));

        nafudaRegistry = _deployUserRegistry(impl, operator);
        ethRegistry.register("nafuda", operator, nafudaRegistry, address(0), ETH_TOKEN_ROLES, uint64(block.timestamp + 365 days));
        vm.prank(operator);
        nafudaRegistry.setParent(ethRegistry, "nafuda");

        bgsRegistry = _deployUserRegistry(impl, grader);
        controller = new TitleControllerV2(bgsRegistry, grader, NameCoder.encode("bgs-sim.nafuda.eth"), GRADER_NAME);
        vm.prank(operator);
        nafudaRegistry.register(
            "bgs-sim",
            grader,
            bgsRegistry,
            address(controller),
            RegistryRolesLib.ROLE_SET_SUBREGISTRY | RegistryRolesLib.ROLE_SET_RESOLVER,
            type(uint64).max
        );

        vm.startPrank(grader);
        bgsRegistry.setParent(nafudaRegistry, "bgs-sim");
        bgsRegistry.grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR, address(controller));
        bgsRegistry.revokeRootRoles(EACBaseRolesLib.ALL_ROLES & ~GRADER_FINAL_ROOT_ROLES, grader);
        vm.stopPrank();
    }

    function _deployUserRegistry(UserRegistry impl, address admin) internal returns (UserRegistry) {
        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant(admin, EACBaseRolesLib.ALL_ROLES);
        bytes memory initData = abi.encodeCall(UserRegistry.initialize, (grants));
        return UserRegistry(verifiableFactory.deployProxy(address(impl), uint256(keccak256(initData)), initData));
    }

    function _subgrades() internal pure returns (string[] memory keys, string[] memory values) {
        keys = new string[](4);
        values = new string[](4);
        (keys[0], values[0]) = ("subgrade.centering", "9.5");
        (keys[1], values[1]) = ("subgrade.corners", "9.5");
        (keys[2], values[2]) = ("subgrade.edges", "10");
        (keys[3], values[3]) = ("subgrade.surface", "9");
    }

    function _issueWith(string[] memory keys, string[] memory values) internal returns (uint256) {
        vm.prank(grader);
        return controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, keys, values);
    }

    function _name(string memory cert) internal pure returns (bytes memory) {
        return NameCoder.encode(string.concat(cert, ".bgs-sim.nafuda.eth"));
    }

    function _text(string memory cert, string memory key) internal view returns (string memory) {
        bytes memory name = _name(cert);
        return abi.decode(controller.resolve(name, abi.encodeCall(ITextResolver.text, (NameCoder.namehash(name, 0), key))), (string));
    }

    ////////////////////////////////////////////////////////////////////////
    // Same as V1
    ////////////////////////////////////////////////////////////////////////

    function test_V2_issueWithoutAttributes_behavesLikeV1() public {
        vm.prank(grader);
        uint256 tokenId = controller.issue(CERT, alice, chip, CARD, GRADE);

        assertEq(bgsRegistry.ownerOf(tokenId), alice);
        assertEq(bgsRegistry.roles(tokenId, alice), RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, "holder can only transfer");
        assertTrue(bgsRegistry.isEmancipated());
        assertEq(_text(CERT, "title.status"), "ISSUED");
        assertEq(_text(CERT, "slab.chip"), Strings.toChecksumHexString(chip));
        assertEq(_text(CERT, "grade"), GRADE);
        assertEq(_text(CERT, "attributes"), "");
        assertEq(controller.holderOf(CERT), alice);
    }

    function test_V2_guardsAsV1() public {
        (string[] memory keys, string[] memory values) = _subgrades();
        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.NotGrader.selector, alice));
        vm.prank(alice);
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, keys, values);

        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.InvalidCert.selector, "0123"));
        vm.prank(grader);
        controller.issueWithAttributes("0123", alice, chip, CARD, GRADE, keys, values);

        _issueWith(keys, values);
        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.AlreadyIssued.selector, CERT));
        _issueWith(keys, values);
    }

    ////////////////////////////////////////////////////////////////////////
    // Attributes
    ////////////////////////////////////////////////////////////////////////

    function test_V2_attributes_areTextRecords() public {
        (string[] memory keys, string[] memory values) = _subgrades();
        _issueWith(keys, values);

        assertEq(_text(CERT, "attributes"), "subgrade.centering,subgrade.corners,subgrade.edges,subgrade.surface");
        assertEq(_text(CERT, "subgrade.centering"), "9.5");
        assertEq(_text(CERT, "subgrade.edges"), "10");
        assertEq(_text(CERT, "subgrade.surface"), "9");
        assertEq(_text(CERT, "subgrade.unknown"), "");
        assertEq(_text("1004827302", "subgrade.centering"), "", "other certs have no attributes");

        (string[] memory k, string[] memory v) = controller.attributesOf(CERT);
        assertEq(k.length, 4);
        assertEq(k[1], "subgrade.corners");
        assertEq(v[3], "9");
    }

    function test_V2_attributes_emitEvents() public {
        (string[] memory keys, string[] memory values) = _subgrades();
        uint256 labelId = LibLabel.id(CERT);
        vm.expectEmit(address(controller));
        emit TitleControllerV2.TitleIssued(labelId, CERT, alice, chip, CARD, GRADE);
        vm.expectEmit(address(controller));
        emit TitleControllerV2.TitleAttribute(labelId, "subgrade.centering", "9.5");
        _issueWith(keys, values);
    }

    function test_V2_attributes_followTransferAndStayFixed() public {
        (string[] memory keys, string[] memory values) = _subgrades();
        uint256 tokenId = _issueWith(keys, values);
        vm.prank(alice);
        bgsRegistry.safeTransferFrom(alice, bob, tokenId, 1, "");

        bytes memory name = _name(CERT);
        address holder = abi.decode(controller.resolve(name, abi.encodeCall(IAddrResolver.addr, (NameCoder.namehash(name, 0)))), (address));
        assertEq(holder, bob);
        assertEq(_text(CERT, "subgrade.centering"), "9.5", "attributes do not change on transfer");
    }

    function test_V2_attributes_rejectBadInput() public {
        string[] memory one = new string[](1);
        string[] memory none = new string[](0);
        string[] memory v = new string[](1);
        v[0] = "9";

        vm.startPrank(grader);

        vm.expectRevert(TitleControllerV2.InvalidAttributes.selector);
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, one, none);

        string[] memory nine = new string[](9);
        vm.expectRevert(TitleControllerV2.InvalidAttributes.selector);
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, nine, nine);

        string[7] memory badKeys = ["", "Subgrade", "sub grade", "card", "attributes", "slab.chip", "abcdefghijklmnopqrstuvwxyz0123456"];
        for (uint256 i; i < badKeys.length; ++i) {
            one[0] = badKeys[i];
            vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.InvalidAttributeKey.selector, badKeys[i]));
            controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, one, v);
        }

        string[] memory dup = new string[](2);
        (dup[0], dup[1]) = ("subgrade.edges", "subgrade.edges");
        string[] memory dupValues = new string[](2);
        (dupValues[0], dupValues[1]) = ("9", "10");
        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.InvalidAttributeKey.selector, "subgrade.edges"));
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, dup, dupValues);

        one[0] = "subgrade.edges";
        v[0] = "";
        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.InvalidAttributeValue.selector, "subgrade.edges"));
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, one, v);

        v[0] = "12345678901234567890123456789012345678901234567890123456789012345"; // 65 bytes
        vm.expectRevert(abi.encodeWithSelector(TitleControllerV2.InvalidAttributeValue.selector, "subgrade.edges"));
        controller.issueWithAttributes(CERT, alice, chip, CARD, GRADE, one, v);

        vm.stopPrank();
        assertEq(controller.holderOf(CERT), address(0), "nothing was issued");
    }

    ////////////////////////////////////////////////////////////////////////
    // End to end through the Universal Resolver
    ////////////////////////////////////////////////////////////////////////

    function test_V2_universalResolver_readsAttributes() public {
        (string[] memory keys, string[] memory values) = _subgrades();
        _issueWith(keys, values);
        bytes memory name = _name(CERT);
        bytes32 node = NameCoder.namehash(name, 0);

        assertEq(findResolverV2(name), address(controller), "wildcard resolver found");
        (bytes memory result, ) = universalResolver.resolve(name, abi.encodeCall(ITextResolver.text, (node, "subgrade.corners")));
        assertEq(abi.decode(result, (string)), "9.5");
        (result, ) = universalResolver.resolve(name, abi.encodeCall(IAddrResolver.addr, (node)));
        assertEq(abi.decode(result, (address)), alice);
    }
}
