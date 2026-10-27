-- Real MST Blockchain anchoring: relayer bookkeeping + auditor wallets (BridgeKey).
ALTER TABLE users ADD COLUMN wallet_address TEXT;
ALTER TABLE chain_anchors ADD COLUMN anchored_by TEXT;
ALTER TABLE chain_anchors ADD COLUMN claimed_at TEXT;
CREATE INDEX ix_chain_anchors_status ON chain_anchors(status);
