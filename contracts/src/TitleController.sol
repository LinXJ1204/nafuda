// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/contracts/resolvers/profiles/IAddressResolver.sol";
import {IExtendedResolver} from "@ens/contracts/resolvers/profiles/IExtendedResolver.sol";
import {ITextResolver} from "@ens/contracts/resolvers/profiles/ITextResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IPermissionedRegistry} from "~src/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "~src/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "~src/registry/libraries/RegistryRolesLib.sol";
import {LibLabel} from "~src/utils/LibLabel.sol";

/// @title TitleController
/// @notice Issues slab titles for one grader and answers for them as the grader name's wildcard
///         resolver.
///
///         A title is the ENSv2 name `<cert>.<grader>.nafuda.eth` in the grader's registry. Its
///         owner is the current holder of the slab; transferring the name (ERC-1155
///         `safeTransferFrom`) is the change of ownership. The grader records the slab's chip
///         address at issuance, and nobody can change it afterwards.
///
///         Trust model (see docs/plan/slab-title-plan.md §2.1):
///         - Only `GRADER` can issue, and each cert can be issued once.
///         - The holder gets `ROLE_CAN_TRANSFER_ADMIN` and nothing else, so they cannot point the
///           title at another resolver and fake the chip record.
///         - The grader registry is expected to be emancipated: this contract holds only
///           `ROLE_REGISTRAR` on its root, so no one can unregister, re-point, or upgrade titles.
///         - This contract is not upgradeable and has no owner.
///
///         Principle: a chip signature is proof, never authorization. `verifyChip` is a view
///         function, and nothing in this contract changes state because of a chip signature.
contract TitleController is IExtendedResolver, IERC165 {
    ////////////////////////////////////////////////////////////////////////
    // Types, constants, storage
    ////////////////////////////////////////////////////////////////////////

    struct Slab {
        address chip;
        uint64 issuedAt;
        string card;
        string grade;
    }

    /// @notice The only role a title holder ever gets: the right to transfer the title.
    uint256 public constant TITLE_ROLES = RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;

    /// @notice Cert numbers follow PSA's format: digits only, no leading zero, at most 10 digits.
    uint256 public constant MAX_CERT_LENGTH = 10;

    uint256 internal constant COIN_TYPE_ETH = 60;

    IPermissionedRegistry public immutable REGISTRY;
    address public immutable GRADER;

    /// @notice Namehash of the grader name this contract resolves for, e.g. `psa-sim.nafuda.eth`.
    ///         Queries for any other parent (such as a namespace alias) get empty answers.
    bytes32 public immutable PARENT_NODE;

    /// @notice Human-readable grader name, returned as the `grader` text record.
    string public graderName;

    mapping(uint256 labelId => Slab) internal _slabs;

    ////////////////////////////////////////////////////////////////////////
    // Events and errors
    ////////////////////////////////////////////////////////////////////////

    event TitleIssued(
        uint256 indexed labelId,
        string cert,
        address indexed holder,
        address indexed chip,
        string card,
        string grade
    );

    error NotGrader(address caller);
    error InvalidCert(string cert);
    error InvalidHolder();
    error InvalidChip();
    error AlreadyIssued(string cert);

    /// @dev Same signature as `IUniversalResolver.UnsupportedResolverProfile`, so clients
    ///      treat it as "this resolver does not support that record type".
    error UnsupportedResolverProfile(bytes4 selector);

    ////////////////////////////////////////////////////////////////////////
    // Construction
    ////////////////////////////////////////////////////////////////////////

    /// @param registry The grader's title registry (a `UserRegistry` proxy).
    /// @param grader The grader account allowed to issue titles.
    /// @param parentName DNS-encoded grader name, e.g. `NameCoder.encode("psa-sim.nafuda.eth")`.
    /// @param graderName_ Human-readable grader name for the `grader` text record.
    constructor(
        IPermissionedRegistry registry,
        address grader,
        bytes memory parentName,
        string memory graderName_
    ) {
        REGISTRY = registry;
        GRADER = grader;
        PARENT_NODE = NameCoder.namehash(parentName, 0);
        graderName = graderName_;
    }

    ////////////////////////////////////////////////////////////////////////
    // Issuance
    ////////////////////////////////////////////////////////////////////////

    /// @notice Issue the title for a newly encapsulated slab.
    /// @param cert The cert number printed on the slab label; it becomes the name's label.
    /// @param holder The submitter, who becomes the first title holder.
    /// @param chip The address of the key inside the slab's chip.
    /// @param card Card description as graded.
    /// @param grade Grade as graded.
    /// @return tokenId The ERC-1155 token id of the title.
    function issue(
        string calldata cert,
        address holder,
        address chip,
        string calldata card,
        string calldata grade
    ) external returns (uint256 tokenId) {
        if (msg.sender != GRADER) revert NotGrader(msg.sender);
        if (!_isCanonicalCert(bytes(cert))) revert InvalidCert(cert);
        if (holder == address(0)) revert InvalidHolder();
        if (chip == address(0)) revert InvalidChip();

        uint256 labelId = LibLabel.id(cert);
        if (_slabs[labelId].chip != address(0)) revert AlreadyIssued(cert);

        _slabs[labelId] = Slab({chip: chip, issuedAt: uint64(block.timestamp), card: card, grade: grade});

        // No subregistry, no resolver (queries fall back to this contract as the parent's
        // resolver), never expires, and the holder can only transfer.
        tokenId = REGISTRY.register(
            cert,
            holder,
            IRegistry(address(0)),
            address(0),
            TITLE_ROLES,
            type(uint64).max
        );

        emit TitleIssued(labelId, cert, holder, chip, card, grade);
    }

    ////////////////////////////////////////////////////////////////////////
    // Views
    ////////////////////////////////////////////////////////////////////////

    /// @notice The slab record for `cert`. `chip == address(0)` means no title was issued.
    function slabOf(string calldata cert) external view returns (Slab memory) {
        return _slabs[LibLabel.id(cert)];
    }

    /// @notice The current title holder for `cert`, or `address(0)` if none was issued.
    function holderOf(string calldata cert) external view returns (address) {
        uint256 labelId = LibLabel.id(cert);
        return _slabs[labelId].chip == address(0) ? address(0) : REGISTRY.getOwner(labelId);
    }

    /// @notice Whether `signature` is the slab chip's EIP-191 signature over `message`.
    /// @dev Proof only. The caller is responsible for the message's freshness and format, e.g.
    ///      `ENS-SLAB|<grader>|<cert>|<nonce>|<unix seconds>` with a nonce it generated itself.
    function verifyChip(
        string calldata cert,
        bytes calldata message,
        bytes calldata signature
    ) external view returns (bool) {
        address chip = _slabs[LibLabel.id(cert)].chip;
        if (chip == address(0)) return false;
        (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(
            MessageHashUtils.toEthSignedMessageHash(message),
            signature
        );
        return err == ECDSA.RecoverError.NoError && signer == chip;
    }

    ////////////////////////////////////////////////////////////////////////
    // Resolution (ENSIP-10 wildcard resolver for `<cert>.<grader>.nafuda.eth`)
    ////////////////////////////////////////////////////////////////////////

    /// @inheritdoc IExtendedResolver
    /// @dev Records are computed from registry state and this contract's storage, so they can
    ///      never go stale. The node inside `data` is ignored; `name` is authoritative.
    ///
    ///      Supported records:
    ///      - `addr(bytes32)` and `addr(bytes32, 60)`: the current title holder
    ///      - `text`: `title.status` (`ISSUED` / `NONE`), `slab.chip`, `card`, `grade`,
    ///        `issued_at` (unix seconds), `grader`
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes4 selector = bytes4(data);
        (bool isCertName, uint256 labelId) = _parseCertName(name);
        Slab storage slab = _slabs[labelId];
        bool issued = isCertName && slab.chip != address(0);

        if (selector == IAddrResolver.addr.selector) {
            return abi.encode(issued ? REGISTRY.getOwner(labelId) : address(0));
        }
        if (selector == IAddressResolver.addr.selector) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            bytes memory holder = issued && coinType == COIN_TYPE_ETH
                ? abi.encodePacked(REGISTRY.getOwner(labelId))
                : bytes("");
            return abi.encode(holder);
        }
        if (selector == ITextResolver.text.selector) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(isCertName ? _text(slab, issued, key) : "");
        }
        revert UnsupportedResolverProfile(selector);
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == type(IExtendedResolver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    /// @dev A cert name is exactly one canonical cert label directly under `PARENT_NODE`.
    function _parseCertName(bytes calldata name) internal view returns (bool, uint256) {
        (string memory label, uint256 next) = NameCoder.extractLabel(name, 0);
        if (!_isCanonicalCert(bytes(label))) return (false, 0);
        if (NameCoder.namehash(name, next) != PARENT_NODE) return (false, 0);
        return (true, LibLabel.id(label));
    }

    /// @dev Digits only, no leading zero, 1 to MAX_CERT_LENGTH characters.
    ///      This keeps one name per cert: "012345" and "12345" can't both exist.
    function _isCanonicalCert(bytes memory cert) internal pure returns (bool) {
        uint256 n = cert.length;
        if (n == 0 || n > MAX_CERT_LENGTH || cert[0] == "0") return false;
        for (uint256 i; i < n; ++i) {
            if (cert[i] < "0" || cert[i] > "9") return false;
        }
        return true;
    }

    function _text(Slab storage slab, bool issued, string memory key) internal view returns (string memory) {
        bytes32 k = keccak256(bytes(key));
        if (k == keccak256("title.status")) return issued ? "ISSUED" : "NONE";
        if (k == keccak256("grader")) return graderName;
        if (!issued) return "";
        if (k == keccak256("slab.chip")) return Strings.toChecksumHexString(slab.chip);
        if (k == keccak256("card")) return slab.card;
        if (k == keccak256("grade")) return slab.grade;
        if (k == keccak256("issued_at")) return Strings.toString(slab.issuedAt);
        return "";
    }
}
