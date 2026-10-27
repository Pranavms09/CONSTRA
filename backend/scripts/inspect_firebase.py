#!/usr/bin/env python3
"""Minimal diagnostic script to investigate Firestore 403 / credential resolution."""

import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
import firebase_admin
from firebase_admin import firestore as admin_firestore
import google.auth
from google.api_core.exceptions import GoogleAPICallError


def main():
    print("=" * 60)
    print("CONSTRA FIRESTORE CREDENTIAL & ACCESS DIAGNOSTIC")
    print("=" * 60)

    # 1. Configured Project ID
    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"
    print(f"Configured Project ID:       {project_id}")

    # 2. Service account path resolution
    configured_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    print(f"Configured Service Acc Path: {configured_path}")

    resolved_path = None
    for candidate in [
        configured_path,
        os.path.join("backend", configured_path),
        os.path.join("..", configured_path),
        os.path.abspath(configured_path),
    ]:
        if candidate and os.path.exists(candidate) and os.path.isfile(candidate):
            resolved_path = candidate
            break

    print(f"Resolved Service Acc Path:   {resolved_path if resolved_path else 'None (file not found on disk)'}")

    # 3. Credential Source & Service Account Email
    cred_source = "None"
    sa_email = "None"

    if resolved_path:
        cred_source = f"Service Account File ({resolved_path})"
        try:
            import json
            with open(resolved_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                sa_email = data.get("client_email", "unknown")
        except Exception as e:
            sa_email = f"Error reading file: {e}"
    elif os.environ.get("FIRESTORE_EMULATOR_HOST"):
        cred_source = f"Firestore Emulator ({os.environ.get('FIRESTORE_EMULATOR_HOST')})"
        sa_email = "Emulator (AnonymousCredentials)"
    else:
        try:
            adc_creds, adc_project = google.auth.default()
            cred_source = f"Application Default Credentials (ADC) [type: {type(adc_creds).__name__}]"
            sa_email = getattr(adc_creds, "service_account_email", None) or "None (user ADC / compute engine)"
        except Exception as adc_err:
            cred_source = f"None (google.auth.default error: {type(adc_err).__name__})"
            sa_email = "None"

    print(f"Active Credential Source:    {cred_source}")
    print(f"Resolved Service Account:    {sa_email}")
    print("-" * 60)

    # 4. Attempt Client Operations & Identify Exact Failing Operation
    print("Testing Firestore Operations:")
    from app.services.firestore_db import get_firestore_client

    try:
        client = get_firestore_client()
        print("  Client Initialization:     SUCCESS")
    except Exception as init_err:
        print(f"  Client Initialization:     FAILED ({type(init_err).__name__}: {init_err})")
        print("=" * 60)
        return

    # Operation 1: Document Get
    op1_name = "Document Get (chain_anchors/test_probe)"
    try:
        doc = client.collection("chain_anchors").document("test_probe").get()
        print(f"  {op1_name}: SUCCESS (exists={doc.exists})")
    except Exception as op1_err:
        print(f"  {op1_name}: FAILED ({type(op1_err).__name__}: {op1_err})")

    # Operation 2: Query Stream
    op2_name = "Query Stream (chain_anchors.limit(1))"
    try:
        docs = list(client.collection("chain_anchors").limit(1).stream())
        print(f"  {op2_name}: SUCCESS (count={len(docs)})")
    except Exception as op2_err:
        print(f"  {op2_name}: FAILED ({type(op2_err).__name__}: {op2_err})")

    # Operation 3: Count Aggregation
    op3_name = "Count Aggregation (chain_anchors.count())"
    try:
        cnt = client.collection("chain_anchors").count().get()[0][0].value
        print(f"  {op3_name}: SUCCESS (count={cnt})")
    except Exception as op3_err:
        print(f"  {op3_name}: FAILED ({type(op3_err).__name__}: {op3_err})")

    print("=" * 60)


if __name__ == "__main__":
    main()
