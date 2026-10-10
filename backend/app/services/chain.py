import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional, Tuple

from app.config import settings
from app.services.chain_hooks import normalize_sha256
from app.services.firestore_db import get_firestore_client

logger = logging.getLogger(__name__)

ABI_PATH = Path(__file__).resolve().parent.parent / "abi" / "EvidenceRegistry.json"


class ChainService:
    def __init__(self):
        self._w3 = None
        self._contract = None
        self._account = None
        self._abi = None

    def _load_abi(self) -> list:
        if self._abi is not None:
            return self._abi

        if ABI_PATH.exists():
            with open(ABI_PATH, "r", encoding="utf-8") as f:
                self._abi = json.load(f)
                return self._abi

        raise FileNotFoundError(f"EvidenceRegistry ABI not found at {ABI_PATH}")

    def get_client(self):
        """Lazy initialization of Web3 client and contract."""
        if self._w3 is not None and self._contract is not None:
            return self._w3, self._contract, self._account

        from web3 import Web3

        if not settings.RPC_URL:
            raise ValueError("RPC_URL is not configured for real chain mode")
        if not settings.CONTRACT_ADDRESS:
            raise ValueError("CONTRACT_ADDRESS is not configured for real chain mode")
        if not settings.ANCHOR_PRIVATE_KEY:
            raise ValueError("ANCHOR_PRIVATE_KEY is not configured for real chain mode")

        self._w3 = Web3(Web3.HTTPProvider(settings.RPC_URL))
        if not self._w3.is_connected():
            raise ConnectionError(f"Could not connect to Ethereum RPC at {settings.masked_rpc_url}")

        if settings.CHAIN_ID is not None:
            rpc_chain_id = self._w3.eth.chain_id
            if rpc_chain_id != settings.CHAIN_ID:
                raise ValueError(
                    f"Connected RPC chain ID ({rpc_chain_id}) does not match "
                    f"configured CHAIN_ID ({settings.CHAIN_ID})"
                )

        abi = self._load_abi()
        checksum_address = self._w3.to_checksum_address(settings.CONTRACT_ADDRESS)
        self._contract = self._w3.eth.contract(address=checksum_address, abi=abi)
        self._account = self._w3.eth.account.from_key(settings.ANCHOR_PRIVATE_KEY)

        return self._w3, self._contract, self._account

    def is_fake_mode(self) -> bool:
        return settings.CHAIN_MODE.lower() == "fake"

    def get_wallet_address(self) -> Optional[str]:
        if self.is_fake_mode():
            return "0xSIMULATED_WALLET_ADDRESS"
        try:
            _, _, account = self.get_client()
            return account.address
        except Exception as exc:
            logger.warning("Could not determine wallet address: %s", exc)
            return None

    def get_wallet_balance_eth(self) -> Optional[float]:
        if self.is_fake_mode():
            return 10.0  # Simulated 10 ETH
        try:
            w3, _, account = self.get_client()
            balance_wei = w3.eth.get_balance(account.address)
            return float(w3.from_wei(balance_wei, "ether"))
        except Exception as exc:
            logger.warning("Could not fetch wallet balance: %s", exc)
            return None

    def is_wallet_low_on_funds(self, threshold_eth: float = 0.005) -> bool:
        if self.is_fake_mode():
            return False
        balance = self.get_wallet_balance_eth()
        if balance is None:
            return True
        return balance < threshold_eth

    def send_batch(self, hashes: List[str], kinds: List[int]) -> str:
        """Sends an anchor transaction for one or more hashes.
        
        Uses anchor for single items, and anchorMany for batches up to 50 items.
        Returns the transaction hash string.
        """
        if not hashes:
            raise ValueError("No hashes provided to send_batch")
        if len(hashes) != len(kinds):
            raise ValueError("Length mismatch between hashes and kinds")
        if len(hashes) > 50:
            raise ValueError(f"Batch size {len(hashes)} exceeds maximum of 50")

        norm_hashes = [normalize_sha256(h) for h in hashes]
        for k in kinds:
            if not isinstance(k, int) or k not in (1, 2, 3):
                raise ValueError(f"Invalid kind '{k}'. Must be 1 (photo), 2 (challan), or 3 (certificate)")

        if self.is_fake_mode():
            combined = "".join(norm_hashes) + str(time.time())
            digest = hashlib.sha256(combined.encode("utf-8")).hexdigest()
            fake_tx = f"0xFAKE{digest[:58]}"
            logger.info("Fake mode: anchored %d item(s) with simulated tx_hash %s", len(hashes), fake_tx)
            return fake_tx

        # REAL MODE: Submit transaction to blockchain
        w3, contract, account = self.get_client()
        bytes32_hashes = [bytes.fromhex(h) for h in norm_hashes]

        rpc_chain_id = w3.eth.chain_id
        if settings.CHAIN_ID is not None and rpc_chain_id != settings.CHAIN_ID:
            raise ValueError(
                f"Connected RPC chain ID ({rpc_chain_id}) does not match "
                f"configured CHAIN_ID ({settings.CHAIN_ID})"
            )

        nonce = w3.eth.get_transaction_count(account.address, "pending")
        chain_id = settings.CHAIN_ID or rpc_chain_id

        if len(bytes32_hashes) == 1:
            fn = contract.functions.anchor(bytes32_hashes[0], kinds[0])
        else:
            fn = contract.functions.anchorMany(bytes32_hashes, kinds)

        tx_params = {
            "from": account.address,
            "nonce": nonce,
            "chainId": chain_id,
        }

        # Check fee mechanism (EIP-1559 support)
        latest_block = w3.eth.get_block("latest")
        if "baseFeePerGas" in latest_block and latest_block["baseFeePerGas"] is not None:
            base_fee = latest_block["baseFeePerGas"]
            priority_fee = w3.eth.max_priority_fee if hasattr(w3.eth, "max_priority_fee") else w3.to_wei(1.5, "gwei")
            max_fee = int(base_fee * 1.5) + priority_fee
            tx_params["maxFeePerGas"] = max_fee
            tx_params["maxPriorityFeePerGas"] = priority_fee
        else:
            tx_params["gasPrice"] = w3.eth.gas_price

        # Estimate gas with 20% safety margin
        try:
            gas_est = fn.estimate_gas(tx_params)
            tx_params["gas"] = int(gas_est * 1.20)
        except Exception as gas_err:
            logger.warning("Gas estimation failed: %s; falling back to default gas limit", gas_err)
            tx_params["gas"] = 120000 + (35000 * len(hashes))

        built_tx = fn.build_transaction(tx_params)
        signed_tx = account.sign_transaction(built_tx)

        # Support both web3.py v6 and v7/v8
        raw_tx = getattr(signed_tx, "raw_transaction", None)
        if raw_tx is None:
            raw_tx = getattr(signed_tx, "rawTransaction", None)
        if raw_tx is None:
            raise AttributeError("Unable to retrieve raw transaction bytes from signed transaction")

        tx_hash_bytes = w3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex = tx_hash_bytes.hex()
        if not tx_hash_hex.startswith("0x"):
            tx_hash_hex = f"0x{tx_hash_hex}"

        logger.info("Real mode: Broadcast transaction %s for %d item(s)", tx_hash_hex, len(hashes))
        return tx_hash_hex

    def wait_for_receipt(self, tx_hash: str, timeout: int = 120) -> Tuple[int, int]:
        """Waits for transaction receipt.
        
        Returns (block_number, block_timestamp).
        Raises RuntimeError if reverted or timed out.
        """
        if self.is_fake_mode():
            block_num = 1000000 + int(time.time()) % 10000
            block_time = int(time.time())
            return block_num, block_time

        w3, _, _ = self.get_client()
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        if receipt.get("status") != 1:
            raise RuntimeError(f"Transaction {tx_hash} reverted on-chain (status={receipt.get('status')})")

        block = w3.eth.get_block(receipt.blockNumber)
        return receipt.blockNumber, block.timestamp

    def check_hash(self, sha256_hex: str, fs_client: Optional[Any] = None) -> Tuple[int, int]:
        """Queries whether a hash is anchored on the registry.
        
        Returns (timestamp, kind).
        If not anchored, returns (0, 0).
        """
        norm_h = normalize_sha256(sha256_hex)

        if self.is_fake_mode():
            # Check Firestore fake ledger
            client = fs_client or get_firestore_client()
            doc = client.collection("chain_anchors").document(norm_h).get()
            if doc.exists:
                data = doc.to_dict() or {}
                if data.get("status") == "anchored":
                    anchored_at = data.get("anchored_at")
                    if anchored_at is not None:
                        if hasattr(anchored_at, "timestamp"):
                            timestamp = int(anchored_at.timestamp())
                        elif isinstance(anchored_at, (int, float)):
                            timestamp = int(anchored_at)
                        else:
                            timestamp = int(time.time())
                        return timestamp, int(data.get("kind", 0))
            return 0, 0

        # REAL MODE: Call contract.verify(bytes32)
        w3, contract, _ = self.get_client()
        b_hash = bytes.fromhex(norm_h)
        time_val, kind_val = contract.functions.verify(b_hash).call()
        return int(time_val), int(kind_val)


# Global singleton instance
chain_service = ChainService()
