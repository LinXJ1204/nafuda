// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/contracts/resolvers/profiles/IAddressResolver.sol";
import {IContentHashResolver} from "@ens/contracts/resolvers/profiles/IContentHashResolver.sol";
import {IExtendedResolver} from "@ens/contracts/resolvers/profiles/IExtendedResolver.sol";
import {ITextResolver} from "@ens/contracts/resolvers/profiles/ITextResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {V2Fixture} from "~test/fixtures/V2Fixture.sol";
import {Grant} from "~src/access-control/interfaces/IEACGrantInitializable.sol";
import {IEnhancedAccessControl} from "~src/access-control/interfaces/IEnhancedAccessControl.sol";
import {EACBaseRolesLib} from "~src/access-control/libraries/EACBaseRolesLib.sol";
import {IPermissionedRegistry} from "~src/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "~src/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "~src/registry/libraries/RegistryRolesLib.sol";
import {UserRegistry} from "~src/registry/UserRegistry.sol";
import {LibLabel} from "~src/utils/LibLabel.sol";

import {TitleController} from "../src/TitleController.sol";

/// @notice Tests T1–T8 from docs/plan/slab-title-implementation.md (P1).
///
/// The setup builds the same tree as the Sepolia deployment on top of the official
/// ENSv2 fixture (root → eth):
///
///   nafuda.eth            owned by operator, subregistry = nafudaRegistry (UserRegistry)
///   psa-sim.nafuda.eth    owned by grader, subregistry = psaRegistry (UserRegistry),
///                         resolver = TitleController (wildcard for every cert)
///   <cert>.psa-sim.nafuda.eth   titles issued by TitleController
contract TitleControllerTest is V2Fixture {
    string constant GRADER_NAME = "PSA-Sim (simulated grader modeled after PSA; not affiliated with PSA)";
    string constant CERT = "12345678";
    string constant CERT_2 = "12345679";
    string constant UNISSUED = "99999999";

    /// Roles the grader keeps on psaRegistry's root after setup: it can swap the issuing
    /// contract, set the parent, and name the contract. Nothing that touches existing titles.
    uint256 constant GRADER_FINAL_ROOT_ROLES =
        RegistryRolesLib.ROLE_REGISTRAR_ADMIN |
        RegistryRolesLib.ROLE_SET_PARENT |
        RegistryRolesLib.ROLE_SET_PARENT_ADMIN |
        RegistryRolesLib.ROLE_CAN_NAME |
        RegistryRolesLib.ROLE_CAN_NAME_ADMIN;

    /// Same bitmap ETHRegistrar grants a .eth registrant.
    uint256 constant ETH_TOKEN_ROLES =
        RegistryRolesLib.ROLE_SET_SUBREGISTRY |
        RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN |
        RegistryRolesLib.ROLE_SET_RESOLVER |
        RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN |
        RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;

    /// The grader's `psa-sim` token before the final lock (P7-4 revokes these).
    uint256 constant GRADER_NAME_TOKEN_ROLES =
        RegistryRolesLib.ROLE_SET_SUBREGISTRY |
        RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN |
        RegistryRolesLib.ROLE_SET_RESOLVER |
        RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN;

    address operator = makeAddr("operator");
    address grader = makeAddr("grader");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address mallory = makeAddr("mallory");

    UserRegistry nafudaRegistry;
    UserRegistry psaRegistry;
    TitleController controller;

    address chip;
    address cloneChip;
    string card;
    string grade;

    function setUp() public {
        deployV2Fixture();
        UserRegistry impl = new UserRegistry(labelStore, address(this));

        // nafuda.eth (operator)
        nafudaRegistry = _deployUserRegistry(impl, operator);
        ethRegistry.register(
            "nafuda",
            operator,
            nafudaRegistry,
            address(0),
            ETH_TOKEN_ROLES,
            uint64(block.timestamp + 365 days)
        );
        vm.prank(operator);
        nafudaRegistry.setParent(ethRegistry, "nafuda");

        // psa-sim.nafuda.eth (grader) with TitleController as its wildcard resolver
        psaRegistry = _deployUserRegistry(impl, grader);
        controller = new TitleController(
            psaRegistry,
            grader,
            NameCoder.encode("psa-sim.nafuda.eth"),
            GRADER_NAME
        );
        vm.prank(operator);
        nafudaRegistry.register(
            "psa-sim",
            grader,
            psaRegistry,
            address(controller),
            GRADER_NAME_TOKEN_ROLES,
            type(uint64).max
        );

        // Grader hands issuance to the controller and gives up everything else.
        vm.startPrank(grader);
        psaRegistry.setParent(nafudaRegistry, "psa-sim");
        psaRegistry.grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR, address(controller));
        psaRegistry.revokeRootRoles(EACBaseRolesLib.ALL_ROLES & ~GRADER_FINAL_ROOT_ROLES, grader);
        vm.stopPrank();

        // Simulated chip for CERT, shared with the web app via demo/slabs.json.
        string memory json = vm.readFile("../demo/slabs.json");
        chip = vm.parseJsonAddress(json, ".slabs.12345678.genuine.address");
        cloneChip = vm.parseJsonAddress(json, ".slabs.12345678.clone.address");
        card = vm.parseJsonString(json, ".slabs.12345678.card");
        grade = vm.parseJsonString(json, ".slabs.12345678.grade");
    }

    function _deployUserRegistry(UserRegistry impl, address admin) internal returns (UserRegistry) {
        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant(admin, EACBaseRolesLib.ALL_ROLES);
        bytes memory initData = abi.encodeCall(UserRegistry.initialize, (grants));
        return UserRegistry(verifiableFactory.deployProxy(address(impl), uint256(keccak256(initData)), initData));
    }

    function _issue(string memory cert, address holder) internal returns (uint256 tokenId) {
        vm.prank(grader);
        tokenId = controller.issue(cert, holder, chip, card, grade);
    }

    function _name(string memory cert) internal pure returns (bytes memory) {
        return NameCoder.encode(string.concat(cert, ".psa-sim.nafuda.eth"));
    }

    function _text(string memory cert, string memory key) internal view returns (string memory) {
        bytes memory name = _name(cert);
        bytes memory data = abi.encodeCall(ITextResolver.text, (NameCoder.namehash(name, 0), key));
        return abi.decode(controller.resolve(name, data), (string));
    }

    function _addr(string memory cert) internal view returns (address) {
        bytes memory name = _name(cert);
        bytes memory data = abi.encodeCall(IAddrResolver.addr, (NameCoder.namehash(name, 0)));
        return abi.decode(controller.resolve(name, data), (address));
    }

    ////////////////////////////////////////////////////////////////////////
    // Setup sanity: the trust model the tests below rely on
    ////////////////////////////////////////////////////////////////////////

    function test_setup_graderKeepsOnlyNonDangerousRootRoles() public view {
        uint256 root = psaRegistry.ROOT_RESOURCE();
        assertEq(psaRegistry.roles(root, grader), GRADER_FINAL_ROOT_ROLES, "grader root roles");
        assertEq(psaRegistry.roles(root, address(controller)), RegistryRolesLib.ROLE_REGISTRAR, "controller root roles");
        assertFalse(psaRegistry.hasRootRoles(RegistryRolesLib.ROLE_REGISTRAR, grader), "grader cannot register directly");
    }

    ////////////////////////////////////////////////////////////////////////
    // T1 issue: holder owns the title and can only transfer it
    ////////////////////////////////////////////////////////////////////////

    function test_T1_issue_holderOwnsTitleWithOnlyTransferRole() public {
        uint256 tokenId = _issue(CERT, alice);
        uint256 labelId = LibLabel.id(CERT);

        assertEq(psaRegistry.getOwner(labelId), alice, "owner");
        assertEq(psaRegistry.ownerOf(tokenId), alice, "ERC-1155 owner");
        assertEq(psaRegistry.roles(tokenId, alice), RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, "holder roles");
        assertEq(uint8(psaRegistry.getStatus(labelId)), uint8(IPermissionedRegistry.Status.REGISTERED), "status");
        assertEq(psaRegistry.getExpiry(labelId), type(uint64).max, "never expires");
        assertEq(psaRegistry.getResolver(CERT), address(0), "no leaf resolver: falls back to the controller");

        TitleController.Slab memory slab = controller.slabOf(CERT);
        assertEq(slab.chip, chip);
        assertEq(slab.card, card);
        assertEq(slab.grade, grade);
        assertEq(slab.issuedAt, block.timestamp);
        assertEq(controller.holderOf(CERT), alice);
    }

    function test_T1_issue_emitsTitleIssued() public {
        vm.expectEmit(address(controller));
        emit TitleController.TitleIssued(LibLabel.id(CERT), CERT, alice, chip, card, grade);
        _issue(CERT, alice);
    }

    ////////////////////////////////////////////////////////////////////////
    // T2 issuance guards
    ////////////////////////////////////////////////////////////////////////

    function test_T2_issue_revertsWhenAlreadyIssued() public {
        _issue(CERT, alice);
        vm.expectRevert(abi.encodeWithSelector(TitleController.AlreadyIssued.selector, CERT));
        _issue(CERT, bob);
    }

    function test_T2_issue_revertsForNonGrader() public {
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(TitleController.NotGrader.selector, mallory));
        controller.issue(CERT, mallory, chip, card, grade);
    }

    function test_T2_issue_revertsForZeroHolderOrChip() public {
        vm.startPrank(grader);
        vm.expectRevert(TitleController.InvalidHolder.selector);
        controller.issue(CERT, address(0), chip, card, grade);
        vm.expectRevert(TitleController.InvalidChip.selector);
        controller.issue(CERT, alice, address(0), card, grade);
        vm.stopPrank();
    }

    ////////////////////////////////////////////////////////////////////////
    // T3 cert format: one name per cert
    ////////////////////////////////////////////////////////////////////////

    function test_T3_issue_rejectsNonCanonicalCerts() public {
        string[5] memory bad = ["012345", "12a45", "12345678901", "", "1234 5678"];
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(grader);
            vm.expectRevert(abi.encodeWithSelector(TitleController.InvalidCert.selector, bad[i]));
            controller.issue(bad[i], alice, chip, card, grade);
        }
    }

    function test_T3_issue_acceptsBoundaryCerts() public {
        _issue("1", alice);
        _issue("9999999999", alice);
        assertEq(controller.holderOf("1"), alice);
        assertEq(controller.holderOf("9999999999"), alice);
    }

    ////////////////////////////////////////////////////////////////////////
    // T4 emancipated title registry: safe transfer works, nobody can claw back
    ////////////////////////////////////////////////////////////////////////

    function test_T4_titleRegistryIsEmancipated() public view {
        assertTrue(psaRegistry.isEmancipated());
    }

    function test_T4_safeTransfer_andResell() public {
        uint256 tokenId = _issue(CERT, alice);

        vm.prank(alice);
        psaRegistry.safeTransferFrom(alice, bob, tokenId, 1, "");
        assertEq(psaRegistry.getOwner(LibLabel.id(CERT)), bob);
        assertEq(psaRegistry.roles(tokenId, bob), RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN, "roles move with the title");
        assertEq(psaRegistry.roles(tokenId, alice), 0, "seller keeps nothing");

        vm.prank(bob);
        psaRegistry.safeTransferFrom(bob, alice, tokenId, 1, "");
        assertEq(psaRegistry.getOwner(LibLabel.id(CERT)), alice);
    }

    function test_T4_graderCannotClawBackOrRepoint() public {
        uint256 tokenId = _issue(CERT, alice);
        uint256 resource = psaRegistry.getResource(tokenId);

        vm.startPrank(grader);
        vm.expectRevert(
            abi.encodeWithSelector(
                IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector,
                resource,
                RegistryRolesLib.ROLE_UNREGISTER,
                grader
            )
        );
        psaRegistry.unregister(tokenId);

        vm.expectRevert(
            abi.encodeWithSelector(
                IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector,
                resource,
                RegistryRolesLib.ROLE_SET_RESOLVER,
                grader
            )
        );
        psaRegistry.setResolver(tokenId, grader);
        vm.stopPrank();
    }

    ////////////////////////////////////////////////////////////////////////
    // T5 holder cannot re-point the title (and so cannot fake the chip record)
    ////////////////////////////////////////////////////////////////////////

    function test_T5_holderCannotSetResolverOrSubregistry() public {
        uint256 tokenId = _issue(CERT, alice);
        uint256 resource = psaRegistry.getResource(tokenId);

        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector,
                resource,
                RegistryRolesLib.ROLE_SET_RESOLVER,
                alice
            )
        );
        psaRegistry.setResolver(tokenId, alice);

        vm.expectRevert(
            abi.encodeWithSelector(
                IEnhancedAccessControl.EACUnauthorizedAccountRoles.selector,
                resource,
                RegistryRolesLib.ROLE_SET_SUBREGISTRY,
                alice
            )
        );
        psaRegistry.setSubregistry(tokenId, IRegistry(alice));
        vm.stopPrank();
    }

    ////////////////////////////////////////////////////////////////////////
    // T6 resolve(): records computed from on-chain state
    ////////////////////////////////////////////////////////////////////////

    function test_T6_resolve_issuedTitle() public {
        _issue(CERT, alice);

        assertEq(_addr(CERT), alice, "addr");
        assertEq(_text(CERT, "title.status"), "ISSUED");
        assertEq(_text(CERT, "slab.chip"), Strings.toChecksumHexString(chip));
        assertEq(_text(CERT, "card"), card);
        assertEq(_text(CERT, "grade"), grade);
        assertEq(_text(CERT, "issued_at"), Strings.toString(block.timestamp));
        assertEq(_text(CERT, "grader"), GRADER_NAME);
        assertEq(_text(CERT, "unknown.key"), "");
    }

    function test_T6_resolve_addrWithCoinType() public {
        _issue(CERT, alice);
        bytes memory name = _name(CERT);
        bytes32 node = NameCoder.namehash(name, 0);

        bytes memory eth = abi.decode(
            controller.resolve(name, abi.encodeCall(IAddressResolver.addr, (node, 60))),
            (bytes)
        );
        assertEq(eth, abi.encodePacked(alice), "coinType 60");

        bytes memory btc = abi.decode(
            controller.resolve(name, abi.encodeCall(IAddressResolver.addr, (node, 0))),
            (bytes)
        );
        assertEq(btc.length, 0, "other coin types are empty");
    }

    function test_T6_resolve_followsTransfer() public {
        uint256 tokenId = _issue(CERT, alice);
        vm.prank(alice);
        psaRegistry.safeTransferFrom(alice, bob, tokenId, 1, "");
        assertEq(_addr(CERT), bob);
    }

    function test_T6_resolve_unissuedCert() public view {
        assertEq(_text(UNISSUED, "title.status"), "NONE");
        assertEq(_addr(UNISSUED), address(0));
        assertEq(_text(UNISSUED, "slab.chip"), "");
        assertEq(_text(UNISSUED, "grader"), GRADER_NAME);
    }

    function test_T6_resolve_nonCertNamesGetEmptyAnswers() public {
        _issue(CERT, alice);
        string[3] memory names = [
            "psa-sim.nafuda.eth", // the grader name itself
            "x.12345678.psa-sim.nafuda.eth", // deeper than a cert
            "12345678.psa-sim.evil.eth" // same label under another parent (alias)
        ];
        for (uint256 i; i < names.length; ++i) {
            bytes memory name = NameCoder.encode(names[i]);
            bytes32 node = NameCoder.namehash(name, 0);
            string memory status = abi.decode(
                controller.resolve(name, abi.encodeCall(ITextResolver.text, (node, "title.status"))),
                (string)
            );
            address holder = abi.decode(controller.resolve(name, abi.encodeCall(IAddrResolver.addr, (node))), (address));
            assertEq(status, "", names[i]);
            assertEq(holder, address(0), names[i]);
        }
    }

    function test_T6_resolve_unsupportedProfileReverts() public {
        bytes memory name = _name(CERT);
        bytes memory data = abi.encodeCall(IContentHashResolver.contenthash, (NameCoder.namehash(name, 0)));
        vm.expectRevert(
            abi.encodeWithSelector(
                TitleController.UnsupportedResolverProfile.selector,
                IContentHashResolver.contenthash.selector
            )
        );
        controller.resolve(name, data);
    }

    function test_T6_supportsExtendedResolver() public view {
        assertTrue(controller.supportsInterface(type(IExtendedResolver).interfaceId));
        assertTrue(controller.supportsInterface(0x01ffc9a7)); // ERC-165
        assertFalse(controller.supportsInterface(0xffffffff));
    }

    ////////////////////////////////////////////////////////////////////////
    // T7 chip verification (proof only; shared test vectors with the web app)
    ////////////////////////////////////////////////////////////////////////

    function test_T7_verifyChip_sharedTestVectors() public {
        _issue(CERT, alice);
        string memory json = vm.readFile("../demo/test-vectors.json");
        bytes memory message = bytes(vm.parseJsonString(json, ".message"));

        assertEq(vm.parseJsonAddress(json, ".genuine.address"), chip, "vectors match demo/slabs.json");
        assertTrue(controller.verifyChip(CERT, message, vm.parseJsonBytes(json, ".genuine.signature")), "genuine chip");
        assertFalse(controller.verifyChip(CERT, message, vm.parseJsonBytes(json, ".clone.signature")), "clone chip");
    }

    function test_T7_verifyChip_rejectsTamperedMessageAndUnissuedCert() public {
        string memory json = vm.readFile("../demo/test-vectors.json");
        bytes memory message = bytes(vm.parseJsonString(json, ".message"));
        bytes memory sig = vm.parseJsonBytes(json, ".genuine.signature");

        assertFalse(controller.verifyChip(CERT, message, sig), "not issued yet");
        _issue(CERT, alice);
        assertFalse(controller.verifyChip(CERT, bytes.concat(message, "x"), sig), "tampered message");
        assertFalse(controller.verifyChip(CERT, message, hex"1234"), "malformed signature");
    }

    function test_T7_verifyChip_doesNotChangeState() public {
        uint256 tokenId = _issue(CERT, alice);
        string memory json = vm.readFile("../demo/test-vectors.json");
        controller.verifyChip(
            CERT,
            bytes(vm.parseJsonString(json, ".message")),
            vm.parseJsonBytes(json, ".genuine.signature")
        );
        assertEq(psaRegistry.ownerOf(tokenId), alice);
    }

    ////////////////////////////////////////////////////////////////////////
    // T8 end-to-end through UniversalResolverV2 (wildcard via the parent's resolver)
    ////////////////////////////////////////////////////////////////////////

    function test_T8_universalResolver_resolvesTitle() public {
        _issue(CERT, alice);
        bytes memory name = _name(CERT);
        bytes32 node = NameCoder.namehash(name, 0);

        assertEq(findResolverV2(name), address(controller), "wildcard resolver found");

        (bytes memory result, address resolver) = universalResolver.resolve(
            name,
            abi.encodeCall(IAddrResolver.addr, (node))
        );
        assertEq(resolver, address(controller));
        assertEq(abi.decode(result, (address)), alice, "addr via UR");

        (result, ) = universalResolver.resolve(name, abi.encodeCall(ITextResolver.text, (node, "slab.chip")));
        assertEq(abi.decode(result, (string)), Strings.toChecksumHexString(chip), "slab.chip via UR");
    }

    function test_T8_universalResolver_unissuedCert() public view {
        bytes memory name = _name(UNISSUED);
        (bytes memory result, ) = universalResolver.resolve(
            name,
            abi.encodeCall(ITextResolver.text, (NameCoder.namehash(name, 0), "title.status"))
        );
        assertEq(abi.decode(result, (string)), "NONE");
    }
}
