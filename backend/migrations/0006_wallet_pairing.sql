-- Phone sign-in by QR: a desktop BridgeKey wallet approves a pairing the phone created, then the phone claims a session.
CREATE TABLE wallet_pairings (
  id TEXT PRIMARY KEY,          -- shown in the QR code
  secret_hash TEXT NOT NULL,    -- SHA-256 of the secret only the phone holds
  user_id INTEGER REFERENCES users(id),
  expires_at TEXT NOT NULL
);
