"""
Maison Noir — Certificate Issuer
==================================
Run this once per sale to generate a signed, verifiable certificate for
the buyer. It reads your private key from maison_noir_private.key
(must be in the same folder, or update PRIVATE_KEY_PATH below).

Usage:
    python3 issue_certificate.py

Edit the SALE section below with the real details for each sale, or wire
this into your checkout flow later (e.g. call issue_certificate() from a
Stripe webhook once payment succeeds).

The certificate is:
  1. A JSON file you keep as your own record + send to the buyer
  2. Verifiable by ANYONE on the public verification page, forever,
     without ever needing your private key or trusting a database

How the signature works:
  We build a plain pipe-delimited message string from the certificate's
  fields (order matters and must never change), sign that exact string
  with your Ed25519 private key, and attach the signature. The
  verification page rebuilds the same string from the fields it's shown
  and checks the signature against your public key. If a single
  character in the certificate changes, the signature no longer matches.
"""

import base64
import json
import uuid
from datetime import datetime, timezone
from nacl.signing import SigningKey

PRIVATE_KEY_PATH = "maison_noir_private.key"


def build_message(cert: dict) -> str:
    """
    Canonical message that gets signed. Field order is fixed on purpose —
    do not reorder these without also updating the verification page's JS,
    or old certificates will stop verifying.
    """
    return "|".join([
        cert["id"],
        cert["tier"],
        str(cert["edition"]),
        str(cert["edition_total"]),
        cert["artwork_hash"],
        cert["buyer_name"],
        cert["issued_at"],
    ])


def issue_certificate(tier: str, edition: int, edition_total: int,
                       artwork_hash: str, buyer_name: str) -> dict:
    with open(PRIVATE_KEY_PATH, "r") as f:
        signing_key = SigningKey(base64.b64decode(f.read().strip()))

    cert = {
        "id": str(uuid.uuid4()),
        "tier": tier,
        "edition": edition,
        "edition_total": edition_total,
        "artwork_hash": artwork_hash,
        "buyer_name": buyer_name,
        "issued_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    message = build_message(cert).encode("utf-8")
    signed = signing_key.sign(message)
    cert["signature"] = base64.b64encode(signed.signature).decode("ascii")

    return cert


if __name__ == "__main__":
    # ---- SALE DETAILS — edit these per sale ----
    tier = "Gold Band"
    edition = 47
    edition_total = 800
    # artwork_hash: sha256 of the actual artwork file for this piece.
    # For real use: hashlib.sha256(open("gold_band_047.png","rb").read()).hexdigest()
    artwork_hash = "3f9a2c1e7b5d8046a1c2e9f4b7d0a3c6e8f1b4d7a0c3e6f9b2d5a8c1e4f7b0a3"
    buyer_name = "A. Collector"
    # ---------------------------------------------

    cert = issue_certificate(tier, edition, edition_total, artwork_hash, buyer_name)

    filename = f"certificate_{cert['id']}.json"
    with open(filename, "w") as f:
        json.dump(cert, f, indent=2)

    print(f"Certificate issued: {filename}")
    print(json.dumps(cert, indent=2))
