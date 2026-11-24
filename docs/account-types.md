# QC Account Types: implementation status

This document compares the **"QC ACCOUNTS TYPE"** spec (the pricing PDF) with the `que_code_bn` backend. It covers:

1. what the backend had before this work;
2. what this work added;
3. what is still missing.

---

## 1. Summary

The spec defines **7 account types**. Each one has its own price, daily transfer limit, per-use fees (115 / 250 RWF) and set of allowed features:

| Group | Account type | Price / month | Daily transfer limit |
|---|---|---|---|
| Private | Starter (Bronze) | Free | 35 000 RWF |
| Private | Premium (Silver) | 1 490 RWF | 150 000 RWF |
| Private | V.I.P (Gold) | 4 900 RWF | 4 000 000 RWF |
| Professional | Freelance | 2 490 RWF | 500 000 RWF |
| Professional | Business | Quote on demand | On demand |
| Non-profit | NPO | Free | 500 000 RWF |
| Special | Agent | Free | On demand |

The spec also has a "No account" column, for someone who pays without signing up. It is not stored as a type and is not supported today.

**Before this work:**
- The backend had no account types, plans, fees or limits.
- The only split was between the `User` and `Organization` tables, plus admin roles (RBAC).
- Every transaction hard-coded `fee: 0`.

**After this work:**
- Every user and organization has an `accountTier`.
- The whole spec lives in one config file.
- The existing money features are gated by account type, charge their per-use fees and respect the daily limit.
- Paid plans are billed monthly from the QC wallet.
- Admins can assign account types and unlock "on demand" features.

---

## 2. Feature status (spec vs. backend)

Legend: ✅ exists, ⚠️ partial, ❌ missing.

"Before" is the state before this work. "Account-type rules now applied" describes what this work added on top.

| # | Spec service | Before | Account-type rules now applied | Where |
|---|---|---|---|---|
| 1 | Payment | ✅ QC wallet only (no MoMo/card) | Daily limit | `transactionController.transferMoney`, `chatMoneyController` |
| 2 | Money top-up | ❌ no endpoint, no provider | ✅ **added, simulated** (§3.8); free for every account type | `services/topUp.service.ts`, `services/topUpProviders.ts` |
| 3 | Money receipt | ✅ | none needed | `receiptController`, `utils/pdfGenerator.ts` |
| 4 | Money transfer | ✅ | Daily limit | `transactionController`, `chatMoneyController` |
| 5 | Instant transfer | ⚠️ every transfer is already instant | Fee **not** charged (see §6) | — |
| 6 | Transfer limit | ❌ | ✅ **added** | `services/accountTier.service.ts` |
| 7 | Personalized transfer (tagged money) | ✅ | Gate + fee | `transferMoney`, batch, scheduled |
| 8 | Communication (comment) | ✅ `description` / `note` | Fee when a comment is sent | `transferMoney`, chat, batch, scheduled |
| 9 | Scheduled payment | ✅ | Gate + fee per occurrence; limit checked at execution | `scheduledTransferController`, `scheduledTransferExecutionService` |
| 10 | Blocked transfer | ✅ escrow | Gate + fee + limit | `escrowController.createEscrow` |
| 11 | Transfer tracking | ⚠️ remaining tagged amount only | **not enforced** | `getWalletRestrictions` |
| 12 | Bulk payment | ✅ up to 100 recipients | Gate + one fee per batch + limit on the batch total | `batchTransferController`, scheduled batch |
| 13 | Currency RWF/USD/EUR | ❌ column only | Listed per account type, not enforced | `Wallet.currency` |
| 14 | Financial advice | ❌ | — | — |
| 15 | Money management tools | ⚠️ partial | free for all, nothing to gate | `walletItemsController` |
| 16 | Transaction history & stats | ✅ | free for all | `analyticsController` |
| 17 | Group creation / participation | ✅ groups, shared wallets, split bill | free for all | group*, sharedWallet*, bill* |
| 18 | Automatic acknowledgement | ❌ | — | — |
| 19 | Category creation | ⚠️ seeded categories only | Gate defined, no endpoint to gate | `seed-transaction-categories` |
| 20 | Second QC | ❌ one QR per profile | Gate defined, feature missing | `profiles.model.ts` |
| 21 | Action creation | ✅ | Gate (Business / NPO) | `actionController.createActionStepA` |
| 22 | Instant money receipt | ✅ sockets / FCM | free, nothing to gate | `socketManager`, `firebaseService` |
| 23 | Payment amount setting | ✅ payment requests + action pricing | **not enforced** (see §6) | `transactionController` (`/request*`) |
| 24 | Storing information | ✅ QR objects (tickets, badges…) | **not enforced** | `qrObject.model.ts` |
| 25 | AI chatbot | ❌ | — | — |
| 26 | Employee management | ❌ | — | — |
| 27 | Product management | ❌ | — | — |
| 28 | Receiving any type of money | ⚠️ incoming rules | **not enforced** | `walletIncomingRule` |
| 29 | Customer support | ✅ support chat | SLA / channel per account type not implemented | `supportChat.controller.ts` |

---

## 3. What was implemented

### 3.1 Single source of truth: `src/utils/accountTiers.ts`
The whole spec is one typed object, `TIERS`. For each account type it holds:
- the monthly price (`priceRwf`);
- the daily transfer limit (`dailyTransferLimit`);
- the allowed currencies;
- the support level;
- one entry per feature: `{ allowed, fee, onDemand }`.

**To change a price, fee or limit, edit this file only.** Nothing else reads the PDF values.

The feature keys are `instantTransfer`, `personalizedTransfer`, `comment`, `scheduledPayment`, `blockedTransfer`, `transferTracking`, `bulkPayment`, `categoryCreation`, `secondQc`, `actionCreation`, `instantMoneyReceipt`, `paymentAmountSetting`, `storingInformation`, `aiChatbot`, `employeeManagement`, `productManagement` and `receiveAnyMoney`.

Which account types each entity can have:
- **Users:** `STARTER` (default), `PREMIUM`, `VIP`, `FREELANCE`, `AGENT`.
- **Organizations:** `BUSINESS` (default), `NPO`.
- **Self-service:** users can buy `PREMIUM`, `VIP` or `FREELANCE` themselves, and go back to `STARTER`. `AGENT`, `BUSINESS` and `NPO` are assigned by an admin.

### 3.2 Database (migration `20261111000000-add-account-tiers.js`)

| Change | Purpose |
|---|---|
| `Users.accountTier`, ENUM, default `STARTER` | User account type |
| `Organizations.accountTier`, ENUM, default `BUSINESS` | Organization account type |
| `AccountSubscriptions` table | Monthly billing: tier, price, status (`active` / `past_due` / `cancelled` / `expired`), period start and end, `pendingTier` for scheduled downgrades, `autoRenew` |
| `FeatureGrants` table | Admin unlocks for "on demand" features, an optional custom fee, or a custom `dailyTransferLimit` |
| Platform wallet `00000000-0000-4000-8000-00000000fee0` | Wallet with no owner that collects fees and plan payments |

The new models are `accountSubscription.model.ts` and `featureGrant.model.ts`. They are registered in `models/index.ts` with their associations.

### 3.3 Runtime rules: `src/services/accountTier.service.ts`

| Function | What it does |
|---|---|
| `quoteOutgoing({ senderWallet, amount, features })` | The main entry point. Finds the account that owns the sender wallet, checks that each feature is allowed, checks the daily limit, and returns the total `fee`. |
| `creditPlatformFee(fee, t)` | Credits the platform wallet with a fee the sender already paid as part of `totalAmount`. |
| `payPlatform(...)` | Moves money to the platform wallet as its own transaction (standalone fees, plan payments). |
| `chargeFeatureUse(...)` | Gate + standalone fee in one call (used for escrow). |
| `assertFeature(account, feature)` | Gate only. Throws `403 UPGRADE_REQUIRED`. |
| `describeAccountPlan(account)` | Plan summary for the API. |
| `sendTierError(res, err)` | Turns tier errors into HTTP responses. |

How the rules behave:
- **Wallet owner:**
  - A user wallet uses the user's account type.
  - An organization wallet or sub-action wallet uses the organization's account type.
  - Group, shared and contribution wallets have no account type, so no rules apply to them.
- **Daily limit:**
  - It is the sum of today's completed sends from the wallet. "Today" is the Kigali day (UTC+2).
  - Fees and plan payments do not count toward it.
  - `null` means no limit, unless an admin grant sets one.
- **Grants:** an active, unexpired `FeatureGrant` overrides the account type's default for that feature. It allows the feature, with the grant's own fee or for free.
- **Fees:** the fee is added to what the sender pays. The receiver still gets the full amount, and the fee is recorded in the transaction's `fee` column.

### 3.4 Where the rules are enforced

| Flow | Rules applied |
|---|---|
| `POST /transactions/transfer` | `comment` fee if there is a description, `personalizedTransfer` fee if the transfer is tagged, daily limit |
| Paying a payment request | Daily limit |
| `POST /chats/:chatId/send-money` | `comment` fee if there is a note, daily limit |
| `POST /transactions/batch-transfer` | `bulkPayment` gate, one fee per batch (charged only if at least one transfer succeeds), daily limit on the batch total |
| Scheduled transfer create (single and batch) | `scheduledPayment` (+ personalized / comment) fee stored on the row and held with each occurrence; `bulkPayment` gate for batches |
| Scheduled transfer execution | Daily limit (a failure releases the hold, same as any other failure); fee credited to the platform |
| Escrow create | `blockedTransfer` gate + fee + daily limit |
| Action create (wizard step A) | `actionCreation` gate (Business / NPO) |
| Action purchase | Daily limit |
| Split-bill share payment (pay / cover) | Daily limit |
| Shared-wallet deposit | Daily limit (withdrawals come out of the pooled wallet, which has no account type) |
| Group contribution / public contribution payment | Daily limit |

These "pay for something" flows are **Payment** in the spec, which is free on every account type, so they only apply the limit. Money leaving group, campaign or shared wallets (disbursements, withdrawals) isn't limited, because those wallets have no account type.

Two error codes go to the frontend:
- `403 { code: "UPGRADE_REQUIRED", feature, currentTier, requiredTiers, onDemand }`
- `400 { code: "DAILY_LIMIT_EXCEEDED", dailyLimit, usedToday, remainingToday }`

There is also a new route middleware, `requireFeature(feature)`, in `auth.unified.middleware.ts`. `req.user.accountTier` is now set on every authenticated request.

### 3.5 Plans and billing: `src/services/accountSubscription.service.ts`
- **Upgrade** (to a more expensive plan): the full price is taken from the wallet now and a new 30-day period starts. There is no partial-month credit.
- **Downgrade** (to a cheaper plan or Starter): it is stored as `pendingTier` and takes effect at the end of the paid period.
- **Cancel:** `autoRenew = false`. The account keeps the paid type until the period ends.
- **Renewal job** (`src/jobs/subscriptionJobs.ts`, runs hourly):
  - If the charge works, the plan is renewed.
  - If the balance is too low, the subscription becomes `past_due` and the account keeps its type for **3 days** (`SUBSCRIPTION_GRACE_DAYS`), with retries every hour.
  - After that, the subscription expires and the account goes back to Starter.
- Users get notifications of the new types `PLAN_CHANGED`, `PLAN_RENEWED`, `PLAN_PAYMENT_FAILED` and `PLAN_EXPIRED`.

### 3.6 API

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/v1/plans` | public | The full plan table, for the pricing page |
| `GET /api/v1/plans/me` | user / org | Current account type, effective features, limit used and remaining today, subscription |
| `POST /api/v1/plans/me/change` `{ tier, pin }` | user | Upgrade or downgrade. The PIN is required when the plan costs money |
| `POST /api/v1/plans/me/cancel` | user / org | Stop auto-renewal |
| `GET /api/v1/admin/plans/accounts/:kind/:id` | admin | Plan summary of any user or organization (`kind` = `user` / `organization`) |
| `PUT /api/v1/admin/plans/accounts/:kind/:id/tier` `{ tier }` | admin | Assign any account type, with no billing (agents, NPO approval, business deals) |
| `POST /api/v1/plans/me/npo-request` `{ note }` | organization | Ask for the NPO account type (min 10 characters). The organization stays Business until approved |
| `DELETE /api/v1/plans/me/npo-request` | organization | Withdraw the request |
| `GET /api/v1/admin/plans/npo-requests` | admin | Pending NPO requests, oldest first. Approve with the `tier` endpoint above (`NPO`), which also clears the request |
| `POST /api/v1/admin/plans/npo-requests/:organizationId/reject` | admin | Reject a request |
| `GET /api/v1/admin/plans/accounts/:kind/:id/grants` | admin | List grants |
| `POST /api/v1/admin/plans/accounts/:kind/:id/grants` `{ feature, fee?, limitAmount?, expiresAt?, note? }` | admin | Unlock an on-demand feature, or set `feature: "dailyTransferLimit"` with `limitAmount` |
| `PUT /api/v1/admin/plans/grants/:grantId` | admin | Edit a grant |
| `DELETE /api/v1/admin/plans/grants/:grantId` | admin | Remove a grant |

The admin routes need the `admin` or `super_admin` role.

### 3.7 Environment flags

| Variable | Default | Effect |
|---|---|---|
| `FEES_ENABLED` | off (`false`) | Per-use fees (115 RWF, etc.) are only charged when this is `true`. Gates and limits apply either way. |
| `TRANSFER_LIMITS_ENABLED` | **on** | Set it to `false` to turn off daily limits. |
| `TOPUP_SIMULATION_ENABLED` | off | `true` = top-ups use the simulated mobile money provider (§3.8). When it is off, and no real provider is integrated, `POST /topups` returns `503`. **Never enable in production.** |
| `TOPUP_SIMULATION_DELAY_MS` | `5000` | How long the simulated provider takes to answer. |

### 3.8 Wallet top-up (simulated mobile money)

There is no MTN MoMo or Airtel Money API access yet, so top-ups run against a **simulated provider**. It behaves like the real APIs: you ask the payer to pay, and the answer arrives later. When the real integration exists, only the provider changes; the endpoints, database and wallet crediting stay the same.

**Flow:**
1. **`POST /topups`** with `{ amount, provider, phoneNumber, note? }` creates a `pending` TopUp and asks the provider to collect. It answers `202`; the real API would now prompt the payer on their phone.
2. **The provider answers.** The simulated one does so after `TOPUP_SIMULATION_DELAY_MS`; a real one would use a callback.
3. **`settleTopUp()`** finishes the top-up:
   - **successful:** the wallet is credited, a `type: "topup"` transaction is recorded, and the user gets a `TOPUP_SUCCESSFUL` notification;
   - **failed:** nothing moves, and the user gets `TOPUP_FAILED`.

   It runs only once per top-up, so a duplicate callback or a late timer can never credit twice.
4. **No answer** after 15 minutes: the top-up is marked `expired` by a job that runs every 5 minutes.

**Rules:**
- **Amount:** a whole number of RWF from 100 to 2 000 000.
- **Phone:** a Rwandan number, written `07…`, `2507…` or `+2507…`. It must belong to the chosen network: MTN numbers start 078 or 079, Airtel numbers 072 or 073.
- **Double taps:** the same wallet, amount, phone and provider within 60 s returns the top-up that is already pending, instead of sending a second prompt.
- **Free:** top-ups have no fee on any account type and don't count toward the daily transfer limit.
- **History:** a top-up shows up in the normal wallet history. The sender is a wallet with no owner (`00000000-0000-4000-8000-0000000e0001`), and the transaction carries `externalSenderName`, `externalSenderContact` and `externalSenderProvider`.

**Simulator test numbers** (the last digits decide the outcome):

| Phone ends with | Outcome |
|---|---|
| `0000` | failed: payer declined |
| `1111` | failed: insufficient funds on mobile money |
| `9999` | never answers, so it expires after 15 min (or use `/simulate`) |
| anything else | successful |

**Endpoints** (all need login):

| Method & path | Description |
|---|---|
| `GET /api/v1/topups/options` | Providers, availability, min/max amount, whether simulation is on |
| `POST /api/v1/topups` | Start a top-up. `202` = waiting for the payer, `200` = the same top-up already pending |
| `GET /api/v1/topups` | My top-ups (`?page&limit`) |
| `GET /api/v1/topups/:id` | Status, for polling |
| `POST /api/v1/topups/:id/simulate` `{ outcome: "successful" \| "failed" }` | Simulation only: settle a pending simulated top-up right away |

**Plugging in real MTN MoMo later:**
- **Provider:** write a `TopUpProvider` in `services/topUpProviders.ts`:
  - `requestPayment` calls MoMo's "Request to Pay" and returns its reference id;
  - `getTopUpProvider` returns it when the MTN keys are set.
- **Callback:** add an endpoint, e.g. `POST /topups/callback/mtn_momo`. It finds the TopUp by `providerReference` and calls `settleTopUp()`.
- **Polling:** optionally, extend the expiry job to ask MoMo for the status before expiring a top-up.

> ⚠️ Because limits are on by default, every existing user becomes **Starter (35 000 RWF / day)** as soon as the migration runs.

---

## 4. Setup

1. **Run the migrations (required):** `20261111000000-add-account-tiers.js` and `20261112000000-add-top-ups.js`. Local databases built by `sequelize.sync` do not get new columns added, so queries on `Users` will fail until `accountTier` exists.
   ```bash
   npm run migrate
   ```
   On the current local database, 6 older migrations are also pending. If one of them fails, run only `20261111000000-add-account-tiers.js`.
2. Set `FEES_ENABLED` and `TRANSFER_LIMITS_ENABLED` in `.env` as needed.
3. Restart the server. The log should print `✅ Subscription jobs initialized`.

---

## 5. How it was tested

These were run against a **copy** of the local database, which was deleted afterwards.

**Migration:** up → down → up runs cleanly, with the correct columns, the two new tables and the platform wallet.

**Service scenarios: 25 out of 25 passed.**
- Starter limit: 20 000 is accepted, another 20 000 is refused, and reaching exactly 35 000 is allowed.
- `TRANSFER_LIMITS_ENABLED=false` bypasses the limit.
- Starter comment + tagged transfer costs 230 RWF; on Premium it is free.
- The escrow fee debits the payer, credits the platform wallet and creates its own transaction.
- Fees and plan payments are excluded from the daily-limit total.
- Upgrade to Premium charges 1 490. The downgrade is scheduled and the job applies it.
- VIP renews and charges 4 900. With no money it becomes `past_due`, and after the grace period it is `expired` and back to Starter.
- Agent bulk payment is refused. An admin grant allows it with a custom fee, and a custom daily limit grant is enforced.

**HTTP smoke test:**
- A transfer was accepted.
- A second transfer was refused with `DAILY_LIMIT_EXCEEDED`.
- `GET /plans/me` showed the correct remaining amount.
- After upgrading to Premium, the same transfer went through.
- Choosing `AGENT` yourself is rejected.
- Admin routes refuse non-admins.

`tsc --noEmit` passes.

---

## 6. Known gaps and limitations of this work

| Gap | Detail |
|---|---|
| Instant transfer fee (250 / 115 RWF) not charged | Every transfer is already instant, so charging it would put a fee on every Starter transfer. It needs a non-instant transfer option first. |
| Not enforced: transfer tracking, payment amount setting, storing information, receiving any type of money | Gating payment amount setting would block payment requests for all private accounts. The other three have no clear place to enforce them yet. |
| Fee frozen on scheduled transfers | The fee is calculated when the transfer is created. A later plan change does not update existing scheduled transfers. |
| No partial-month credit | Upgrading in the middle of a period charges the full price of the new plan. |
| Organization notifications | Plan notifications only go to users (organizations have no notification inbox). |
| Customer support level | Stored per account type, but support chat does not route or prioritise by it. |
| Pre-existing: migration chain broken on an empty DB | `20250416000001-add-mentions-to-chat-messages` fails because `ChatMessages` does not exist yet. |
| Fixed while doing this: held funds | Group and public contributions saved *available balance − amount* as the new balance, so a user with a pending scheduled transfer or escrow lost the held amount when contributing. Action purchases checked the raw balance, so they could spend held funds. Both are fixed. |
| Fixed: signup balance | New wallets used to start with 67 000 RWF. They now start at 0 (money comes in through a top-up). A test environment can set `SIGNUP_WALLET_BALANCE` to seed new accounts. |
| Fixed: security holes | See §10. |

---

## 7. Features from the spec that the app does not have at all

Suggested order:

1. **Real mobile money**: the top-up flow is built but simulated (§3.8). It still needs the MTN MoMo / Airtel API integration, plus card and bank top-up and withdrawals back to mobile money.
2. **Non-instant transfers**: needed before the instant-transfer fee means anything.
3. **Multi-currency wallets and FX**: USD / EUR for VIP, NPO and Agent.
4. **Second QC**: several QR codes per profile.
5. **Category creation**: endpoints for users and organizations to create their own categories (gate already defined).
6. **Automatic acknowledgement**: an automatic thank-you message when money is received.
7. **Transfer tracking**: a record of how tagged money was spent.
8. **Employee management**: payroll, which can reuse bulk and scheduled-batch transfers.
9. **Product management**: inventory, invoices and sales.
10. **AI chatbot** and **financial advice**.
11. **Guest payment** (the "No account" column of the spec).

---

## 8. Frontend status (`que_code_fn`, branch `dev2`)

| Area | Status |
|---|---|
| Top-up | ✅ `components/Wallet/TopUpModal.tsx`, opened by the "Top up" buttons in `WalletHero` and `AccountInfo`. Steps: network + number + amount (with quick amounts) → "Approve on your phone" with polling → success / failed / timed out. In simulation it shows a badge, the test numbers, and Approve / Decline buttons. The balance refreshes when the top-up succeeds, including after the modal is closed (via the `TOPUP_SUCCESSFUL` notification). |
| Onboarding | ✅ `app/onboarding/plan/page.tsx`. After OTP verification, new signups go to login with `returnUrl=/onboarding/plan`. Users pick a plan (paid plans walk through PIN → top-up → pay); organizations pick Business or request NPO (`components/plans/NpoRequestCard.tsx`, also shown in Settings → Plan). Migration `20261117000000-add-npo-requests.js` adds `Organizations.npoRequestedAt` / `npoRequestNote`. |
| Plans | ✅ New **Plan** tab in Settings (`components/settings/PlanTab.tsx`; `/settings?tab=plan` opens it). It shows the current plan, renewal / downgrade / overdue status, today's limit usage, plan cards with upgrade / switch (PIN when money is involved) and a full feature comparison. Organizations see their plans read-only. |
| Limit / upgrade errors | ✅ `utils/tierErrors.tsx` shows a toast with a "See plans" action for `UPGRADE_REQUIRED` / `DAILY_LIMIT_EXCEEDED`. It is wired into transfer, batch transfer, chat send-money / escrow, chat batch send, paying a request, split-bill PIN, shared-wallet deposit, group and public contributions, and action purchases. |
| History | ✅ Top-ups show as "Top-up · MTN Mobile Money" instead of the note. |
| Notifications | ✅ Icons for `TOPUP_*` / `PLAN_*`. |
| Fee preview before confirming | ❌ Not built yet (fees are off: `FEES_ENABLED`). |
| Admin (set account types, on-demand grants) | ❌ There is no admin app in this repo. |
| Mock pages | ⚠️ `app/profile/page.tsx` (reachable from the header menu) and `components/settings/PaymentTab.tsx` are entirely hard-coded demo data ("John Doe", "$1,250.75", a fake Visa card and $ limits). They should be rebuilt or removed. |

New files:
- `types/plan.types.ts`, `types/topUp.types.ts`
- `states/planSlice.ts`, `states/topUpSlice.ts`
- `utils/tierErrors.tsx`, `utils/walletEvents.ts`
- `components/Wallet/TopUpModal.tsx`, `components/settings/PlanTab.tsx`

## 9. File map

**New files:**
- `src/utils/accountTiers.ts`: the spec as config
- `src/services/accountTier.service.ts`: gates, fees, limits, platform wallet
- `src/services/accountSubscription.service.ts`: plan changes and renewals
- `src/controllers/planController.ts`
- `src/routes/plan.routes.ts`
- `src/routes/admin.plans.routes.ts`
- `src/jobs/subscriptionJobs.ts`
- `src/database/models/accountSubscription.model.ts`
- `src/database/models/featureGrant.model.ts`
- `src/database/migrations/20261111000000-add-account-tiers.js`
- Top-up: `src/services/topUp.service.ts`, `src/services/topUpProviders.ts`, `src/controllers/topUpController.ts`, `src/routes/topUp.routes.ts`, `src/jobs/topUpJobs.ts`, `src/database/models/topUp.model.ts`, `src/database/migrations/20261112000000-add-top-ups.js`

**Modified files:**
- `src/controllers/transactionController.ts`: the transfer and payment-request flows; also removed the unused `calculateFee`
- `src/controllers/chatMoneyController.ts`
- `src/controllers/batchTransferController.ts`
- `src/controllers/scheduledTransferController.ts`
- `src/services/scheduledTransferExecutionService.ts`
- `src/controllers/escrowController.ts`
- `src/controllers/actionController.ts`
- `src/middleware/auth.unified.middleware.ts`: `accountTier`, `requireFeature`
- `src/database/models/user.model.ts`, `organization.model.ts`, `index.ts`, `src/types/model.ts`
- `src/utils/notificationConfig.ts`: the plan and top-up notification types
- `src/routes/index.ts`, `src/routes/admin.main.routes.ts`, `src/index.ts`: mounting and the job

## 10. Security fixes

These holes were found and fixed while doing this work. All were checked over HTTP: anonymous requests get `401`, the wrong account gets `403`, and the owner can still do its own edits.

| Hole (before) | Fix |
|---|---|
| **`POST /actions/:actionId/purchase` had no login.** The buyer was taken from `req.body.buyerId`, with no PIN, so anyone could spend any user's wallet on any published action. | Login is required. The buyer is always the logged-in user; a different `buyerId` gets `403`. |
| **Price override:** a client-sent `amount` replaced the price even on fixed-price items (a 100 RWF ticket could be bought for 1 RWF). | `amount` is only accepted for `pay_what_you_want` / `range` pricing. It must be > 0 and inside `pricing.min` / `pricing.max`. Otherwise the listed price is charged. |
| **Negative `quantity`** made the total negative, so nothing was charged but tickets were issued and stock moved. | `quantity` must be a whole number ≥ 1. |
| **Action management had no login:** the wizard steps, publish, update and delete for actions and sub-actions. | Login is required, and the caller must be the owning organization (or an admin). |
| **`POST /qr-objects/:id/use` had no login:** anyone could mark any ticket as used. | Only the organization that issued the ticket (or an admin). |
| **Organization update / delete / activate / deactivate / suspend had no login.** | Update: the organization itself or an admin. Delete: `delete_organizations` permission. Status changes: `approve_organizations` permission. |
| **`update_organization` wrote `...req.body` into the row:** an organization could approve itself (`status: "active"`) or set its own `accountTier`. | `id`, `status`, `accountTier` and timestamps are ignored. Status and account type have their own admin endpoints. |
| **`PUT /profiles/:id` had no login,** and could move a profile to another account (`userId` / `organizationId`). | Login is required and the caller must own the profile. Moving a profile to another account is admin-only. |

New file: `src/middleware/ownership.middleware.ts` (`requireSelfOrganization`, `requireActionOwner`, `requireSubActionOwner`, `requireQRObjectOwner`, `requireProfileOwner`).

The frontend already sends a login token on all of these calls, and only edits its own resources, so it keeps working unchanged.

**Still open:**
- **Purchases need no PIN.** The frontend doesn't send one, so requiring it needs a frontend change at the same time.
- **Ticket and purchase lists are public:** `GET /users/:userId/qr-objects` and `/purchases` need no login. The frontend reads other users' lists on profile pages, so this needs a product decision first.
- **Organization password:** an organization can change its own password through `PUT /organizations/:id` without giving the current one.
