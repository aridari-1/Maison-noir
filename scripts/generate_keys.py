"""
Maison Noir — Certificate Signing Key Generator
=================================================
Run this ONCE. It creates two files:

  maison_noir_private.key   <-- KEEP THIS SECRET. Never upload, email, or
                                 commit it anywhere. Anyone who has this file
                                 can forge certificates in your name.
                                 Store it in a password manager or offline
                                 (USB drive in a drawer), not just on your laptop.

  maison_noir_public.key    <-- This is safe to share. It gets embedded in
                                 the public verification page so anyone can
                                 check a certificate's authenticity without
                                 ever needing your private key.

If you ever lose the private key, or think it's been exposed, you must
generate a new pair and re-issue certificates — there is no "reset password"
for this, which is exactly what makes it secure.
"""

import base64
from nacl.signing import SigningKey

signing_key = SigningKey.generate()
verify_key = signing_key.verify_key

private_b64 = base64.b64encode(bytes(signing_key)).decode("ascii")
public_b64 = base64.b64encode(bytes(verify_key)).decode("ascii")

with open("maison_noir_private.key", "w") as f:
    f.write(private_b64)

with open("maison_noir_public.key", "w") as f:
    f.write(public_b64)

print("Keypair generated.")
print()
print("PRIVATE KEY (secret — keep this safe, do not share):")
print(private_b64)
print()
print("PUBLIC KEY (safe to publish, goes in the verification page):")
print(public_b64)
