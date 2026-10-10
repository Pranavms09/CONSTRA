from typing import Optional, Literal, Dict
from pydantic import BaseModel, Field


class PublicVerifyResponse(BaseModel):
    status: Literal["authentic", "not_found"]
    sha256: str
    anchored_at: Optional[str] = None
    kind: Optional[str] = None
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    simulated: bool = False


class AnchorStatusResponse(BaseModel):
    status: Literal["pending", "sent", "anchored", "failed"]
    sha256: str
    entity: str
    entity_id: str
    kind: int
    tx_hash: Optional[str] = None
    anchored_at: Optional[str] = None
    explorer_url: Optional[str] = None
    simulated: bool = False
    attempts: int = 0
    last_error: Optional[str] = None


class ChainCounts(BaseModel):
    pending: int = 0
    sent: int = 0
    anchored: int = 0
    failed: int = 0


class ChainStatusResponse(BaseModel):
    mode: str
    chain_id: Optional[int] = None
    contract_address: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_balance_eth: Optional[float] = None
    wallet_low_funds: bool = False
    counts: ChainCounts
    explorer_tx_url: Optional[str] = None
    explorer_address_url: Optional[str] = None
    show_chain_copy: bool = False


class RetryAnchorResponse(BaseModel):
    success: bool
    sha256: str
    message: str
