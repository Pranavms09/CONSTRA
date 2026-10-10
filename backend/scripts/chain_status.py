#!/usr/bin/env python3
"""Diagnostic script to inspect CONSTRA blockchain anchoring status and health."""

import json
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.chain import chain_service
from app.services.firestore_db import get_firestore_client


def resolve_service_account_path():
    """Finds backend/secrets/firebase-service-account.json across common working directories."""
    configured_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    candidates = [
        configured_path,
        "backend/secrets/firebase-service-account.json",
        "secrets/firebase-service-account.json",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "secrets", "firebase-service-account.json")),
        os.path.abspath(configured_path),
    ]
    for c in candidates:
        if c and os.path.exists(c) and os.path.isfile(c):
            return c
    return None


def get_safe_sa_identifier(cert_path):
    """Safely reads the service account client_email without exposing private keys or sensitive values."""
    try:
        with open(cert_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("client_email", "unknown_service_account")
    except Exception:
        return "unreadable_service_account"


def main():
    print("=" * 60)
    print("CONSTRA BLOCKCHAIN ANCHORING STATUS")
    print("=" * 60)
    print(f"CHAIN_MODE:           {settings.CHAIN_MODE}")
    print(f"CHAIN_ID:             {settings.CHAIN_ID or 'N/A'}")
    print(f"CONTRACT_ADDRESS:     {settings.CONTRACT_ADDRESS or 'N/A'}")
    print(f"EXPLORER_TX_URL:      {settings.EXPLORER_TX_URL or 'N/A'}")
    print(f"RPC_URL:              {settings.masked_rpc_url or 'N/A'}")
    print(f"BATCH_SIZE:           {settings.ANCHOR_BATCH_SIZE}")
    print(f"BATCH_INTERVAL:       {settings.ANCHOR_BATCH_INTERVAL_SEC}s")
    print(f"MAX_RETRIES:          {settings.ANCHOR_MAX_RETRIES}")
    print(f"SHOW_CHAIN_COPY:      {settings.SHOW_CHAIN_COPY}")
    print("-" * 60)

    try:
        wallet = chain_service.get_wallet_address()
        bal = chain_service.get_wallet_balance_eth()
        low = chain_service.is_wallet_low_on_funds()
        print(f"Wallet Address:       {wallet}")
        print(f"Wallet Balance:       {bal} ETH")
        print(f"Low Funds Warning:    {'YES [LOW FUNDS]' if low else 'NO [OK]'}")
    except Exception as exc:
        print(f"Wallet Error:         {exc}")

    print("-" * 60)
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"
    print(f"FIREBASE PROJECT:     {project_id}")

    sa_path = resolve_service_account_path()
    emulator_host = os.environ.get("FIRESTORE_EMULATOR_HOST")

    if sa_path:
        sa_email = get_safe_sa_identifier(sa_path)
        print(f"SERVICE ACCOUNT:      CONFIGURED ({sa_path})")
        print(f"ACCOUNT IDENTIFIER:   {sa_email}")
        print("-" * 60)
        print("FIRESTORE ANCHOR COUNTS (Real Cloud Firestore):")
        try:
            from google.cloud.firestore import FieldFilter
            client = get_firestore_client()
            for s in ["pending", "sent", "anchored", "failed"]:
                try:
                    cnt = client.collection("chain_anchors").where(filter=FieldFilter("status", "==", s)).count().get()[0][0].value
                except Exception:
                    cnt = len(list(client.collection("chain_anchors").where(filter=FieldFilter("status", "==", s)).stream()))
                print(f"  {s.upper().ljust(12)}: {int(cnt)}")
            print("FIRESTORE PERSISTENCE: CONFIRMED (Real cloud Firestore operational)")
        except Exception as fs_exc:
            print(f"Firestore Error:      {fs_exc}")

    elif emulator_host:
        print(f"SERVICE ACCOUNT:      EMULATOR MODE ({emulator_host})")
        print("ACCOUNT IDENTIFIER:   AnonymousCredentials (local emulator)")
        print("-" * 60)
        print("FIRESTORE ANCHOR COUNTS (Local Emulator):")
        try:
            from google.cloud.firestore import FieldFilter
            client = get_firestore_client()
            for s in ["pending", "sent", "anchored", "failed"]:
                try:
                    cnt = client.collection("chain_anchors").where(filter=FieldFilter("status", "==", s)).count().get()[0][0].value
                except Exception:
                    cnt = len(list(client.collection("chain_anchors").where(filter=FieldFilter("status", "==", s)).stream()))
                print(f"  {s.upper().ljust(12)}: {int(cnt)}")
            print("FIRESTORE PERSISTENCE: CONFIRMED (Local emulator operational)")
        except Exception as fs_exc:
            print(f"Firestore Error:      {fs_exc}")

    else:
        print("SERVICE ACCOUNT:      MISSING (Prerequisite not met)")
        print("EXPECTED PATH:        backend/secrets/firebase-service-account.json")
        print("-" * 60)
        print("FIRESTORE STATUS:     BLOCKED - Real Firestore access requires service account")
        print()
        print("PREREQUISITE ACTION REQUIRED:")
        print("  1. Note: 'google-services.json' is for the Android app only and cannot be used by the backend.")
        print("  2. Open Firebase Console for project 'constra-b561b':")
        print("     https://console.firebase.google.com/project/constra-b561b/settings/serviceaccounts/adminsdk")
        print("  3. Click 'Generate new private key'.")
        print("  4. Save the downloaded service account JSON file to:")
        print("     backend/secrets/firebase-service-account.json")
        print("  5. Recommended minimum IAM role: Cloud Datastore User (roles/datastore.user).")
        print()
        print("  (For offline emulator testing without cloud credentials, run:")
        print("   npx -y firebase-tools@latest emulators:exec --only firestore \".venv/bin/python scripts/chain_status.py\")")

    print("=" * 60)


if __name__ == "__main__":
    main()
