export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  LOGIN_LIMITER: RateLimit;
  VERIFY_LIMITER: RateLimit;
  FIREBASE_PROJECT_ID: string;
  GEMINI_MODEL: string;
  FRONTEND_ORIGINS: string;
  DEMO_MODE: string;
  OCR_MODE: string;
  MAX_UPLOAD_MB: string;
  SHOW_CHAIN_COPY: string;
  CHAIN_MODE: string;
  MST_NETWORK: string;
  MST_CHAIN_ID: string;
  MST_RPC_URL: string;
  MST_EXPLORER_URL: string;
  CONTRACT_ADDRESS: string;
  ACCESS_REGISTRY_ADDRESS?: string;
  ACCESS_REGISTRY_FROM_BLOCK?: string;
  ANCHOR_PRIVATE_KEY?: string;
  SECRET_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
}

export type Role = "supervisor" | "store_incharge" | "auditor";
export const ROLES: Role[] = ["supervisor", "store_incharge", "auditor"];

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  password_hash: string | null;
  firebase_uid: string | null;
  auth_provider: string;
  is_active: number;
  wallet_address: string | null;
}

export type AppEnv = { Bindings: Env; Variables: { user: User } };
