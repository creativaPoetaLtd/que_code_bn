# Secure Chat v1 Runbook

This document is the current implementation contract for QueCode secure direct
messages. It is intentionally scoped to `secure_dm_v1`; secure groups are not
part of this version.

## Current Status

`secure_dm_v1` is a serious proof of concept for private text DMs and encrypted
media. It is not yet the final fintech-grade messaging protocol.

Implemented:

- Direct-message E2EE mode with `securityMode = "secure_dm_v1"`.
- Per-device identity keys, signed prekeys, and one-time prekeys.
- Server-side signed prekey signature verification.
- Server-side one-time prekey reservation and replay protection.
- Device revocation and current device listing.
- Client-side identity pinning with a visible fingerprint verification dialog.
- Client-side encrypted media upload and decrypt-on-device preview/download.
- Secure push/foreground notification redaction.
- Plaintext reactions blocked in secure chats.
- Backend protocol smoke coverage.

Still required before production:

- Encrypted reactions instead of blocked plaintext reactions.
- Secure group messaging.
- Production migration rehearsal and rollback plan.
- Native mobile secure storage when the PWA becomes a mobile app.
- Independent security review of protocol and code.

## Threat Model

This version is designed to protect message and media content from the backend,
database operators, notification providers, Cloudinary storage, and passive
network observers.

This version does not fully protect against:

- A compromised client device.
- Malicious JavaScript served to the client.
- A backend that silently registers attacker-controlled devices before users
  verify fingerprints.
- Metadata exposure such as participants, chat IDs, timestamps, and message
  counts.
- Denial of service, message deletion, or delivery suppression by the server.

## Protocol Summary

Device registration:

1. The client generates a long-lived P-256 ECDSA identity key.
2. The client generates a P-256 ECDH signed prekey.
3. The client signs the canonical JSON form of the signed prekey public JWK
   with the identity private key.
4. The client uploads the public identity key, signed prekey, signature, and a
   batch of one-time prekeys.
5. The backend validates P-256 public key shape, signature presence, duplicate
   key IDs, and cryptographically verifies the signed prekey signature.

Message send:

1. The sender fetches active recipient device bundles.
2. The client verifies signed prekey signatures and checks the local identity
   trust store.
3. The client prefers a recipient one-time prekey when available, otherwise it
   falls back to the signed prekey.
4. The client encrypts one envelope per recipient device.
5. The backend validates sender identity metadata, recipient device membership,
   one-time prekey availability, and reserves consumed one-time prekeys in a DB
   transaction.

Message receive:

1. The client receives only the envelope addressed to the current device.
2. The client rejects envelopes with mismatched sender identity metadata.
3. If a one-time prekey is consumed locally, the client removes the private
   prekey from local storage after decrypting.

Media send:

1. The client encrypts the file with a random media key and IV before upload.
2. The backend uploads only encrypted bytes as raw Cloudinary content.
3. The chat message stores only encrypted media metadata inside the E2EE message
   content.
4. The recipient decrypts media locally for preview or download.

## Key Management Rules

- Private identity, signed prekey, and one-time prekey material must not be
  stored in `localStorage`.
- Browser PWA storage currently uses IndexedDB. This is acceptable for the PWA
  proof of concept, but native mobile must use platform secure storage later.
- Signed prekeys should rotate regularly. The current frontend refresh policy is
  intentionally tolerant so older deployed backends do not break chat.
- One-time prekeys should be refilled before the server-side available count is
  depleted.
- Device revocation prevents future sends to the revoked device but does not
  revoke content that was already delivered to that device.

## Notification Rules

Secure chat notifications must never include:

- Plaintext message content.
- Sender display name.
- Media URLs.
- Encrypted envelope payloads.
- Device key material.

Allowed notification data is limited to routing metadata such as `chatId`,
`messageId`, `messageType`, and an app URL/action.

## Reactions

Plaintext reactions are currently blocked for secure chats on both frontend and
backend.

The production path is to implement reactions as encrypted control messages, for
example:

```json
{
  "kind": "reaction",
  "targetMessageId": "message-id",
  "emoji": "thumbs_up",
  "action": "set"
}
```

Those control messages must be encrypted per recipient device like normal secure
messages and must not use the legacy plaintext reaction socket events.

## Deployment And Rollout

Before merging:

1. Rebase/merge these local branches with the latest `origin/dev2` frontend and
   `origin/dev-2` backend.
2. Run backend checks:
   - `npm run build`
   - `npm run test:e2ee`
3. Run frontend checks:
   - `npm run type-check`
   - `npm run test:e2ee-media`
4. Confirm the DB migration `20260518000000-add-chat-security-and-e2ee-devices`
   has been reviewed against the real production/staging database.
5. Confirm both Netlify origins are temporarily allowed by backend CORS:
   - `https://qiew-code-dev2.netlify.app`
   - `https://qc-dev2.netlify.app`

Rollout order:

1. Deploy backend with old and new frontend origins allowed.
2. Apply the DB migration during a planned window.
3. Deploy the new frontend to `https://qc-dev2.netlify.app`.
4. Ask the team to switch from `qiew-code-dev2.netlify.app` to
   `qc-dev2.netlify.app` only after the new deployment contains all merged work.
5. Keep the old origin allowed temporarily, then remove it after the team has
   moved and no active workflow depends on it.

Rollback:

- Keep old frontend deployment available until the new one is validated.
- Do not drop E2EE tables during rollback. Disable secure chat creation at the
  app level instead, so existing secure metadata is preserved.
- If the migration fails, stop rollout before asking the team to switch links.

## Audit Checklist

Before production fintech use, an external review should verify:

- The canonical signature input for signed prekeys is stable across browsers and
  Node.
- Envelope associated data binds sender, recipient, chat, device IDs, algorithm,
  and message ID.
- One-time prekey reservation is race-safe under concurrent sends.
- Revoked devices cannot receive newly created secure envelopes.
- Media encryption rejects tampering and never renders encrypted URLs directly.
- Notifications cannot leak sensitive secure chat content.
- Secure chat downgrade from `secure_dm_v1` to legacy mode is impossible without
  explicit administrative migration.
- Logs do not store plaintext messages, media keys, private keys, or full
  encrypted payloads unnecessarily.
