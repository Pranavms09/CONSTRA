-- Wallet sign-in on MST: AccessRegistry is the role source of truth; D1 mirrors it.
CREATE UNIQUE INDEX ux_users_wallet ON users(lower(wallet_address)) WHERE wallet_address IS NOT NULL;

-- Single-use sign-in challenges (the exact message the wallet signs).
CREATE TABLE auth_nonces (
  nonce TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX ix_auth_nonces_address ON auth_nonces(address);

-- Relayer bookkeeping, e.g. the last MST block whose RoleSet events were mirrored.
CREATE TABLE chain_sync (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
