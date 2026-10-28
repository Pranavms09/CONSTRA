// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AccessRegistry
 * @dev Source of truth for CONSTRA portal roles on MST Blockchain. One role per wallet; no personal data on-chain.
 * The owner (deployer) and wallets holding the Auditor role grant and revoke roles. The CONSTRA backend reads
 * roleOf at wallet sign-in and mirrors RoleSet events into its database.
 */
contract AccessRegistry {
    uint8 public constant ROLE_NONE = 0;
    uint8 public constant ROLE_SUPERVISOR = 1;
    uint8 public constant ROLE_STORE_INCHARGE = 2;
    uint8 public constant ROLE_AUDITOR = 3;

    address public owner;
    mapping(address => uint8) public roleOf;

    event RoleSet(address indexed account, uint8 role, address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == owner || roleOf[msg.sender] == ROLE_AUDITOR, "Not an auditor");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Grant (1 supervisor, 2 store in-charge, 3 auditor) or revoke (0) a wallet's role.
    function setRole(address account, uint8 role) external onlyAdmin {
        require(account != address(0), "Zero address");
        require(role <= ROLE_AUDITOR, "Invalid role");
        // An auditor cannot strip their own role; the owner remains the recovery path.
        require(account != msg.sender || role == ROLE_AUDITOR || msg.sender == owner, "Cannot revoke yourself");
        roleOf[account] = role;
        emit RoleSet(account, role, msg.sender);
    }

    /// @notice Transfer contract ownership to a new non-zero address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
