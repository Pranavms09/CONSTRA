// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EvidenceRegistry
 * @dev Tamper-evident registry for CONSTRA evidence hashes (photos, challans, certificates).
 * Stores SHA-256 fingerprints and block timestamps. No personal data on-chain.
 */
contract EvidenceRegistry {
    address public owner;

    // hash => block timestamp when anchored (0 if not anchored)
    mapping(bytes32 => uint256) public anchoredAt;

    // hash => kind (1 = photo, 2 = challan, 3 = certificate)
    mapping(bytes32 => uint8) public kindOf;

    event Anchored(bytes32 indexed hash, uint8 kind, uint256 time);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Anchor a single evidence hash with its kind.
     * @param h SHA-256 evidence hash (bytes32)
     * @param kind 1 for photo, 2 for challan, 3 for certificate
     */
    function anchor(bytes32 h, uint8 kind) external onlyOwner {
        require(h != bytes32(0), "Zero hash");
        require(anchoredAt[h] == 0, "Already anchored");

        anchoredAt[h] = block.timestamp;
        kindOf[h] = kind;

        emit Anchored(h, kind, block.timestamp);
    }

    /**
     * @notice Batch anchor up to 50 evidence hashes.
     * @dev Skips hashes that are already anchored or zero so one duplicate cannot block the batch.
     * Emits one event per newly anchored item.
     * @param hs Array of SHA-256 evidence hashes (max 50)
     * @param kinds Array of corresponding kinds (1: photo, 2: challan, 3: certificate)
     */
    function anchorMany(bytes32[] calldata hs, uint8[] calldata kinds) external onlyOwner {
        require(hs.length == kinds.length, "Length mismatch");
        require(hs.length > 0 && hs.length <= 50, "Batch size must be 1-50");

        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < hs.length; i++) {
            bytes32 h = hs[i];
            if (h == bytes32(0) || anchoredAt[h] != 0) {
                continue;
            }
            anchoredAt[h] = currentTime;
            kindOf[h] = kinds[i];
            emit Anchored(h, kinds[i], currentTime);
        }
    }

    /**
     * @notice Verify if a hash is anchored.
     * @param h SHA-256 evidence hash
     * @return time Timestamp when anchored (0 if never anchored)
     * @return kind Evidence kind (0 if not anchored, 1: photo, 2: challan, 3: certificate)
     */
    function verify(bytes32 h) external view returns (uint256 time, uint8 kind) {
        return (anchoredAt[h], kindOf[h]);
    }

    /**
     * @notice Transfer contract ownership to a new non-zero address.
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
