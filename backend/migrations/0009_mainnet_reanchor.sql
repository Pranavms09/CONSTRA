-- Platform moved from MST testnet (91562037) to MST mainnet (4646). Re-queue every real testnet anchor so the
-- relayer anchors the same hashes on mainnet; otherwise /chain/verify reports them missing and logs tampering.
-- Certificates waiting for an auditor's wallet stay awaiting_signature (the auditor now signs on mainnet).
-- The testnet tx hashes are dropped from D1; they remain on testnet.mstscan.com.
UPDATE chain_anchors
SET status = CASE WHEN status = 'awaiting_signature' THEN status ELSE 'pending' END,
    tx_hash = NULL, block_number = NULL, anchored_at = NULL, anchored_by = NULL,
    attempts = 0, last_error = NULL, claimed_at = NULL, chain_id = 4646
WHERE chain_id = 91562037 AND simulated = 0;

UPDATE evidence
SET blockchain_status = 'queued', blockchain_tx = NULL, blockchain_block_number = NULL,
    blockchain_network = 'mst-mainnet', blockchain_chain_id = 4646
WHERE blockchain_chain_id = 91562037;
