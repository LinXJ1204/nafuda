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

/// @title TitleControllerV2
/// @notice TitleController plus grader-defined attributes, served as extra ENS text records.
///
///         Everything in TitleController applies unchanged: same issuance rules, same records,
///         same `TitleIssued` event, same trust model (holder can only transfer, the registry is
///         emancipated, no owner, not upgradeable). V1 is deployed and its resolver functions are
///         not virtual, so V2 is a separate contract rather than a subclass.
///
///         What V2 adds: at issuance the grader may attach up to `MAX_ATTRIBUTES` key/value pairs,
///         e.g. BGS-style subgrades (`subgrade.centering` = `9.5`). They are fixed forever, like
///         the chip record. The `attributes` text record lists the keys, so any ENS client can
///         discover them. This is how each grader brings its own record schema to the shared
///         namespace without anyone else's contract changing.
contract TitleControllerV2 is IExtendedResolver, IERC165 {
    ////////////////////////////////////////////////////////////////////////
    // Types, constants, storage
    ////////////////////////////////////////////////////////////////////////

    struct Slab {
        address chip;
        uint64 issuedAt;
        string card;
        string grade;
    }

    uint256 public constant TITLE_ROLES = RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;
    uint256 public constant MAX_CERT_LENGTH = 10;
    uint256 public constant MAX_ATTRIBUTES = 8;
    uint256 public constant MAX_ATTRIBUTE_KEY_LENGTH = 32;
    uint256 public constant MAX_ATTRIBUTE_VALUE_LENGTH = 64;
    uint256 internal constant COIN_TYPE_ETH = 60;

    IPermissionedRegistry public immutable REGISTRY;
    address public immutable GRADER;
    bytes32 public immutable PARENT_NODE;
    string public graderName;

    mapping(uint256 labelId => Slab) internal _slabs;
    mapping(uint256 labelId => string[]) internal _attributeKeys;
    mapping(uint256 labelId => mapping(bytes32 keyHash => string)) internal _attributes;

    ////////////////////////////////////////////////////////////////////////
    // Events and errors
    ////////////////////////////////////////////////////////////////////////

    /// @dev Identical to TitleController's event, so indexers treat both versions the same.
    event TitleIssued(
        uint256 indexed labelId,
        string cert,
        address indexed holder,
        address indexed chip,
        string card,
        string grade
    );

    event TitleAttribute(uint256 indexed labelId, string key, string value);

    error NotGrader(address caller);
    error InvalidCert(string cert);
    error InvalidHolder();
    error InvalidChip();
    error AlreadyIssued(string cert);
    error InvalidAttributes();
    error InvalidAttributeKey(string key);
    error InvalidAttributeValue(string key);
    error UnsupportedResolverProfile(bytes4 selector);

    ////////////////////////////////////////////////////////////////////////
    // Construction
    ////////////////////////////////////////////////////////////////////////

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

    /// @notice Same as TitleController.issue: a title without attributes.
    function issue(
        string calldata cert,
        address holder,
        address chip,
        string calldata card,
        string calldata grade
    ) external returns (uint256 tokenId) {
        return _issue(cert, holder, chip, card, grade, new string[](0), new string[](0));
    }

    /// @notice Issue a title with grader-defined attributes (fixed forever).
    /// @param keys Lowercase `[a-z0-9._-]`, 1–32 characters, unique, not a built-in record key.
    /// @param values 1–64 bytes each.
    function issueWithAttributes(
        string calldata cert,
        address holder,
        address chip,
        string calldata card,
        string calldata grade,
        string[] calldata keys,
        string[] calldata values
    ) external returns (uint256 tokenId) {
        return _issue(cert, holder, chip, card, grade, keys, values);
    }

    function _issue(
        string calldata cert,
        address holder,
        address chip,
        string calldata card,
        string calldata grade,
        string[] memory keys,
        string[] memory values
    ) internal returns (uint256 tokenId) {
        if (msg.sender != GRADER) revert NotGrader(msg.sender);
        if (!_isCanonicalCert(bytes(cert))) revert InvalidCert(cert);
        if (holder == address(0)) revert InvalidHolder();
        if (chip == address(0)) revert InvalidChip();
        if (keys.length != values.length || keys.length > MAX_ATTRIBUTES) revert InvalidAttributes();

        uint256 labelId = LibLabel.id(cert);
        if (_slabs[labelId].chip != address(0)) revert AlreadyIssued(cert);

        _slabs[labelId] = Slab({chip: chip, issuedAt: uint64(block.timestamp), card: card, grade: grade});

        for (uint256 i; i < keys.length; ++i) {
            string memory key = keys[i];
            bytes32 keyHash = keccak256(bytes(key));
            if (!_isValidAttributeKey(bytes(key)) || _isBuiltInKey(keyHash) || bytes(_attributes[labelId][keyHash]).length != 0) {
                revert InvalidAttributeKey(key);
            }
            uint256 n = bytes(values[i]).length;
            if (n == 0 || n > MAX_ATTRIBUTE_VALUE_LENGTH) revert InvalidAttributeValue(key);
            _attributes[labelId][keyHash] = values[i];
            _attributeKeys[labelId].push(key);
        }

        tokenId = REGISTRY.register(cert, holder, IRegistry(address(0)), address(0), TITLE_ROLES, type(uint64).max);

        emit TitleIssued(labelId, cert, holder, chip, card, grade);
        for (uint256 i; i < keys.length; ++i) emit TitleAttribute(labelId, keys[i], values[i]);
    }

    ////////////////////////////////////////////////////////////////////////
    // Views
    ////////////////////////////////////////////////////////////////////////

    function slabOf(string calldata cert) external view returns (Slab memory) {
        return _slabs[LibLabel.id(cert)];
    }

    function holderOf(string calldata cert) external view returns (address) {
        uint256 labelId = LibLabel.id(cert);
        return _slabs[labelId].chip == address(0) ? address(0) : REGISTRY.getOwner(labelId);
    }

    function attributesOf(string calldata cert) external view returns (string[] memory keys, string[] memory values) {
        uint256 labelId = LibLabel.id(cert);
        keys = _attributeKeys[labelId];
        values = new string[](keys.length);
        for (uint256 i; i < keys.length; ++i) values[i] = _attributes[labelId][keccak256(bytes(keys[i]))];
    }

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
    // Resolution
    ////////////////////////////////////////////////////////////////////////

    /// @inheritdoc IExtendedResolver
    /// @dev TitleController's records, plus `attributes` (comma-separated keys) and one text
    ///      record per attribute key.
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes4 selector = bytes4(data);
        (bool isCertName, uint256 labelId) = _parseCertName(name);
        bool issued = isCertName && _slabs[labelId].chip != address(0);

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
            return abi.encode(isCertName ? _text(labelId, issued, key) : "");
        }
        revert UnsupportedResolverProfile(selector);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    function _parseCertName(bytes calldata name) internal view returns (bool, uint256) {
        (string memory label, uint256 next) = NameCoder.extractLabel(name, 0);
        if (!_isCanonicalCert(bytes(label))) return (false, 0);
        if (NameCoder.namehash(name, next) != PARENT_NODE) return (false, 0);
        return (true, LibLabel.id(label));
    }

    function _isCanonicalCert(bytes memory cert) internal pure returns (bool) {
        uint256 n = cert.length;
        if (n == 0 || n > MAX_CERT_LENGTH || cert[0] == "0") return false;
        for (uint256 i; i < n; ++i) {
            if (cert[i] < "0" || cert[i] > "9") return false;
        }
        return true;
    }

    /// @dev `[a-z0-9._-]`, 1 to MAX_ATTRIBUTE_KEY_LENGTH characters.
    function _isValidAttributeKey(bytes memory key) internal pure returns (bool) {
        uint256 n = key.length;
        if (n == 0 || n > MAX_ATTRIBUTE_KEY_LENGTH) return false;
        for (uint256 i; i < n; ++i) {
            bytes1 c = key[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "." || c == "_" || c == "-";
            if (!ok) return false;
        }
        return true;
    }

    function _isBuiltInKey(bytes32 k) internal pure returns (bool) {
        return
            k == keccak256("title.status") ||
            k == keccak256("grader") ||
            k == keccak256("slab.chip") ||
            k == keccak256("card") ||
            k == keccak256("grade") ||
            k == keccak256("issued_at") ||
            k == keccak256("attributes");
    }

    function _text(uint256 labelId, bool issued, string memory key) internal view returns (string memory) {
        bytes32 k = keccak256(bytes(key));
        if (k == keccak256("title.status")) return issued ? "ISSUED" : "NONE";
        if (k == keccak256("grader")) return graderName;
        if (!issued) return "";
        Slab storage slab = _slabs[labelId];
        if (k == keccak256("slab.chip")) return Strings.toChecksumHexString(slab.chip);
        if (k == keccak256("card")) return slab.card;
        if (k == keccak256("grade")) return slab.grade;
        if (k == keccak256("issued_at")) return Strings.toString(slab.issuedAt);
        if (k == keccak256("attributes")) return _joinKeys(_attributeKeys[labelId]);
        return _attributes[labelId][k];
    }

    function _joinKeys(string[] storage keys) internal view returns (string memory out) {
        for (uint256 i; i < keys.length; ++i) out = i == 0 ? keys[i] : string.concat(out, ",", keys[i]);
    }
}
