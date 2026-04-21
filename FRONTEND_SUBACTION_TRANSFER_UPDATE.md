# Frontend Update: Sub-Action Wallet Transfers

## Why this update was made
Previously, transfers could only be sent from:
- a user wallet (`senderUserId`), or
- an organization wallet (`senderOrganizationId`).

Now, transfers can also be sent directly from a **sub-action wallet** using `senderSubActionId`.

This allows organization owners to move sales funds from a sub-action wallet to:
- their organization wallet, or
- any other wallet.

---

## Endpoint (unchanged)
`POST /api/v1/transactions/transfer`

Authentication is required (`Bearer` token).

---

## New request fields
### Added sender option
- `senderSubActionId: string`  
  Use this when sending from a sub-action wallet.

### Added receiver option
- `receiverWalletId: string`  
  Use this to send directly to any wallet by wallet ID.

---

## Sender/receiver selection rules
For each transfer request:

- You must provide **exactly one sender**:
  - `senderUserId` OR
  - `senderOrganizationId` OR
  - `senderSubActionId`

- You must provide **exactly one receiver**:
  - `receiverUserId` OR
  - `receiverOrganizationId` OR
  - `receiverWalletId`

If multiple or none are provided for sender/receiver, API returns `400`.

---

## Authorization logic (important for FE)
When using `senderSubActionId`:

- The authenticated identity must belong to the organization that owns that sub-action.
- If not, API returns `403`.

Notes:
- Organization context comes from authenticated token context.

---

## Request examples

### 1) Move sub-action funds to organization wallet
```json
{
  "senderSubActionId": "SUB_ACTION_UUID",
  "receiverOrganizationId": "ORG_UUID",
  "amount": 1000,
  "description": "Sweep sub-action sales",
  "type": "transfer"
}
```

### 2) Move sub-action funds to a specific wallet
```json
{
  "senderSubActionId": "SUB_ACTION_UUID",
  "receiverWalletId": "WALLET_UUID",
  "amount": 1000,
  "description": "Payout from sub-action",
  "type": "transfer"
}
```

### 3) Existing flows still work (backward compatible)
```json
{
  "senderOrganizationId": "ORG_UUID",
  "receiverUserId": "USER_UUID",
  "amount": 500,
  "description": "Standard transfer",
  "type": "transfer"
}
```

---

## Response changes
Transfer success response now can include:

- `senderSubActionId`
- `receiverWalletId`
- `resolvedReceiverWalletId` (the actual wallet used by backend)

Existing fields are still returned.

---

## Behavior details FE should know
- Same-wallet transfer is blocked (`400`).
- Insufficient funds checks still apply.
- Category/restriction logic still applies.
- Receiver type detection now uses the resolved receiver wallet ownership.

---

## Recommended FE changes
1. **Transfer form sender options**
   - Add `Sub-Action` as a sender type.
   - Load sub-actions owned by the organization and let user select one.

2. **Transfer form receiver options**
   - Keep existing `User` and `Organization` receiver options.
   - Add optional `Wallet ID` receiver option.

3. **Validation before submit**
   - Ensure one sender and one receiver option only.
   - Ensure amount > 0.

4. **Error handling messages**
   - Show backend `403` message when organization is not owner of sub-action.
   - Show `400` conflicts (same wallet, invalid selection shape, insufficient balance).

5. **Transaction detail rendering**
   - If `senderSubActionId` is present, label source as `Sub-Action Wallet`.
   - If `receiverWalletId`/`resolvedReceiverWalletId` is present, show destination as `Wallet`.

---

## Backward compatibility
No endpoint change was introduced. Existing frontend transfer integrations continue to work.

Only additive request/response fields were introduced.
