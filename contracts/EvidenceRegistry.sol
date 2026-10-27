// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EvidenceRegistry
 * @dev Tamper-evident registry for CONSTRA evidence hashes on MST Blockchain.
 * Stores SHA-256 fingerprints of photos, delivery challans and clearance certificates,
 * the block timestamp, and which authorized account anchored them. No personal data on-chain.
 *
 * Anchorers: the owner (CONSTRA backend relayer) plus wallets the owner authorizes
 * (project auditors signing clearance certificates from BridgeKey).
 */
contract EvidenceRegistry {
    uint8 public constant KIND_PHOTO = 1;
    uint8 public constant KIND_CHALLAN = 2;
    uint8 public constant KIND_CERTIFICATE = 3;
    uint256 public constant MAX_BATCH = 50;

    address public owner;

    mapping(address => bool) public isAnchorer;
    // hash => block timestamp when anchored (0 if not anchored)
    mapping(bytes32 => uint256) public anchoredAt;
    // hash => kind (1 = photo, 2 = challan, 3 = certificate)
    mapping(bytes32 => uint8) public kindOf;
    // hash => account that anchored it
    mapping(bytes32 => address) public anchoredBy;

    event Anchored(bytes32 indexed hash, uint8 kind, uint256 time, address indexed by);
    event AnchorerUpdated(address indexed account, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAnchorer() {
        require(msg.sender == owner || isAnchorer[msg.sender], "Not an anchorer");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function _validKind(uint8 kind) private pure returns (bool) {
        return kind >= KIND_PHOTO && kind <= KIND_CERTIFICATE;
    }

    function _record(bytes32 h, uint8 kind, uint256 time) private {
        anchoredAt[h] = time;
        kindOf[h] = kind;
        anchoredBy[h] = msg.sender;
        emit Anchored(h, kind, time, msg.sender);
    }

    /**
     * @notice Anchor a single evidence hash with its kind.
     * @param h SHA-256 evidence hash (bytes32)
     * @param kind 1 for photo, 2 for challan, 3 for certificate
     */
    function anchor(bytes32 h, uint8 kind) external onlyAnchorer {
        require(h != bytes32(0), "Zero hash");
        require(_validKind(kind), "Invalid kind");
        require(anchoredAt[h] == 0, "Already anchored");
        _record(h, kind, block.timestamp);
    }

    /**
     * @notice Batch anchor up to 50 evidence hashes.
     * @dev Skips zero, invalid-kind and already anchored hashes so one bad item cannot block the batch.
     */
    function anchorMany(bytes32[] calldata hs, uint8[] calldata kinds) external onlyAnchorer {
        require(hs.length == kinds.length, "Length mismatch");
        require(hs.length > 0 && hs.length <= MAX_BATCH, "Batch size must be 1-50");

        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < hs.length; i++) {
            bytes32 h = hs[i];
            if (h == bytes32(0) || !_validKind(kinds[i]) || anchoredAt[h] != 0) {
                continue;
            }
            _record(h, kinds[i], currentTime);
        }
    }

    /**
     * @notice Verify if a hash is anchored.
     * @return time Timestamp when anchored (0 if never anchored)
     * @return kind Evidence kind (0 if not anchored)
     * @return by Account that anchored it (zero address if not anchored)
     */
    function verify(bytes32 h) external view returns (uint256 time, uint8 kind, address by) {
        return (anchoredAt[h], kindOf[h], anchoredBy[h]);
    }

    /// @notice Authorize or revoke an anchorer wallet (e.g. an auditor's BridgeKey account).
    function setAnchorer(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero address");
        isAnchorer[account] = allowed;
        emit AnchorerUpdated(account, allowed);
    }

    /// @notice Transfer contract ownership to a new non-zero address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
