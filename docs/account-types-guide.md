# QC account types: guide

This guide explains each QC account type: who it is for, what it costs, how much it can send per day, and what it can and can't do. It follows the "QC ACCOUNTS TYPE" spec and matches what the app enforces today. For the technical details (code, endpoints, tests), see [account-types.md](account-types.md).

All values come from one file, `src/utils/accountTiers.ts`. If a price, fee or limit changes, that file is the only place to update.

---

## At a glance

| Account type | For | Price / month | Daily transfer limit | Currencies | How you get it |
|---|---|---|---|---|---|
| **Starter (Bronze)** | Everyone, by default | Free | 35 000 RWF | RWF | Automatic at signup |
| **Premium (Silver)** | Regular personal users | 1 490 RWF | 150 000 RWF | RWF | Upgrade in Settings → Plan |
| **V.I.P (Gold)** | Heavy personal users | 4 900 RWF | 4 000 000 RWF | RWF, USD, EUR* | Upgrade in Settings → Plan |
| **Freelance** | Self-employed people who get paid by clients | 2 490 RWF | 500 000 RWF | RWF | Upgrade in Settings → Plan |
| **Special Agent** | QC agents | Free | On demand | RWF, USD, EUR* | Set by a QC admin |
| **Business** | Companies, shops, churches… | Quote on demand | On demand | RWF | Default for organizations; terms set by QC |
| **NPO** | Non-profit organisations | Free | 500 000 RWF | RWF, USD, EUR* | Requested by the organization (at signup or in Settings → Plan), approved by a QC admin |

\* Multi-currency is part of the spec but not built yet. Every wallet is RWF today.

**What some terms mean:**
- **Daily limit:** the total a wallet can send in one day. The day resets at midnight, Kigali time. Top-ups, QC fees and plan payments don't count toward it.
- **"On demand"** means QC sets it per account. For limits, an account with "on demand" has no limit until QC sets one. For features, QC can unlock it for that account.
- **115 RWF fee** is charged each time the feature is used. Fees are listed now but **not charged yet**; they start when QC switches them on (`FEES_ENABLED`).

---

## Features by account type

✅ = free · 💰 = 115 RWF per use · 📞 = on demand (ask QC) · — = not included

| Feature | Starter | Premium | VIP | Freelance | Agent | Business | NPO |
|---|---|---|---|---|---|---|---|
| Payment, money transfer, receiving money, top-up | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Instant transfer | 💰 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Personalized transfer (tagged money) | 💰 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment on a transfer | 💰 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scheduled payment | 💰 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blocked transfer (escrow) | 💰 | 💰 | ✅ | 💰 | — | ✅ | 💰 |
| Transfer tracking | 💰 | 💰 | ✅ | 💰 | ✅ | ✅ | 💰 |
| Bulk payment | 💰 | ✅ | ✅ | ✅ | — | ✅ | 💰 |
| Financial advice, money tools, history & stats, groups, auto-acknowledgement | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category creation | — | — | ✅ | — | ✅ | — | 📞 |
| Second QC (extra QR code) | — | — | 📞 | — | — | 📞 | 📞 |
| Action creation | — | — | — | — | — | ✅ | ✅ |
| Instant money receipt | — | — | — | ✅ | ✅ | ✅ | ✅ |
| Payment amount setting | — | — | — | ✅ | ✅ | ✅ | ✅ |
| Storing information (tickets, passes) | — | — | — | — | — | ✅ | 📞 |
| AI chatbot | — | — | — | — | — | 📞 | 📞 |
| Employee management | — | — | — | — | — | 📞 | 📞 |
| Product management | — | — | — | — | — | 📞 | 📞 |
| Receiving any type of money | — | — | — | — | — | — | ✅ |
| Customer support | Mail or chat, Mon–Fri 8–16 | Mail or chat, Mon–Fri 8–16 | Mail, chat, phone, 24/7 | Mail or chat, Mon–Fri 8–16 | Mail, chat, phone, 24/7 | Mail, chat, phone, 24/7 | Mail or chat, Mon–Fri 8–16 |

---

## Starter (Bronze)

**For:** every new personal account. This is where everyone starts.

- **Price:** free
- **Daily limit:** 35 000 RWF
- **Currency:** RWF

**Included free:** payments, transfers, receiving money, top-up, history & stats, groups, money tools.

**Costs 115 RWF per use:**
- instant transfer;
- tagged (personalized) transfer;
- adding a comment to a transfer;
- scheduled payment (charged each time it runs);
- blocked transfer (escrow);
- transfer tracking;
- bulk payment (charged once per batch).

**Not included:** category creation, second QC, and all professional features (actions, instant receipt, setting the amount, storing information, AI, employees, products).

**Example:** a Starter user can send 20 000 RWF in the morning and 15 000 in the afternoon. A third transfer that day is refused, with a message saying the limit is reached and offering to see the plans.

---

## Premium (Silver)

**For:** people who use QC regularly and want the everyday extras for free.

- **Price:** 1 490 RWF / month, paid from the QC wallet
- **Daily limit:** 150 000 RWF
- **Currency:** RWF

**Everything in Starter, and also free:** instant transfer, tagged transfer, comments, scheduled payment, bulk payment.

**Still 115 RWF per use:** blocked transfer (escrow) and transfer tracking.

**Not included:** category creation, second QC, and professional features.

---

## V.I.P (Gold)

**For:** people who move large amounts and want everything personal for free.

- **Price:** 4 900 RWF / month, paid from the QC wallet
- **Daily limit:** 4 000 000 RWF
- **Currencies:** RWF, USD, EUR (not built yet)
- **Support:** mail, chat and phone, 24/7

**Everything free:** all personal features, including blocked transfer and transfer tracking, plus **category creation**.

**On demand:** a second QC (extra QR code).

**Not included:** professional features (actions, payment amount setting, etc.).

---

## Freelance

**For:** self-employed people (taxi drivers, tutors, designers…) who get paid by clients.

- **Price:** 2 490 RWF / month, paid from the QC wallet
- **Daily limit:** 500 000 RWF
- **Currency:** RWF

**Free:** everything in Premium, plus two professional features:
- **Instant money receipt:** get paid immediately whatever method the client uses.
- **Payment amount setting:** set the amount the client must pay (e.g. a taxi fare).

**115 RWF per use:** blocked transfer (escrow) and transfer tracking.

**Not included:** category creation, second QC, action creation, storing information, AI, employees, products.

> A Freelance account is a **personal** account (it logs in like any user). A company should use Business instead.

---

## Special Agent

**For:** QC's own agents, who help people send, receive and top up.

- **Price:** free
- **Daily limit:** on demand (no limit until QC sets one)
- **Currencies:** RWF, USD, EUR (not built yet)
- **Support:** mail, chat and phone, 24/7
- **How to get it:** only a QC admin can make an account an Agent

**Free:** payments, transfers, instant transfer, tagged transfer, comments, scheduled payment, transfer tracking, category creation, instant money receipt, payment amount setting.

**Not included:** blocked transfer (escrow), bulk payment, second QC, actions, storing information, AI, employees, products, receiving any type of money.

---

## Business

**For:** companies, shops, churches, schools: any organization that sells or collects money.

- **Price:** quote on demand. QC agrees a price with the business; there is no self-service payment.
- **Daily limit:** on demand (no limit until QC sets one)
- **Currency:** RWF
- **Support:** mail, chat and phone, 24/7
- **How to get it:** every organization is Business by default. QC sets the negotiated terms.

**Free:**
- every personal feature, including blocked transfer, tracking and bulk payment;
- **action creation:** offer things customers can choose and pay for, e.g. "Offering" and "Tithe" for a church, or tickets for an event;
- instant money receipt and payment amount setting;
- **storing information:** tickets, passes and invoices on a QR code.

**On demand:** second QC, AI chatbot, employee management, product management.

**Not included:** category creation, and receiving any type of money (that is for NPOs).

---

## NPO (non-profit organisation)

**For:** charities, associations and other non-profits.

- **Price:** free
- **Daily limit:** 500 000 RWF
- **Currencies:** RWF, USD, EUR (not built yet)
- **How to get it:** the organization requests it, either right after signup or later in Settings → Plan, with a short description of the non-profit. A QC admin reviews the request. It stays Business until the request is approved.

**Free:**
- payments, transfers, instant transfer, tagged transfer, comments, scheduled payment;
- action creation, instant money receipt, payment amount setting;
- **receiving any type of money:** NPOs can accept money tagged for a cause (e.g. "education", "food aid") as well as general donations. Only NPOs have this.

**115 RWF per use:** blocked transfer, transfer tracking, bulk payment.

**On demand:** category creation, second QC, storing information, AI chatbot, employee management, product management.

---

## Choosing a plan at signup

Right after a new account verifies its email and logs in for the first time, it sees a **"Choose your plan"** step (`/onboarding/plan`).

**Personal accounts:**
1. They see the Starter, Premium, VIP and Freelance cards. Starter is selected by default.
2. **Starter** (or "Skip for now") goes straight to the wallet.
3. For a **paid plan**, a short checklist follows:
   - set the transaction PIN;
   - top up the wallet with at least the plan price;
   - pay with the PIN.

   They can step back or "Stay on Starter for now" at any point.

**Organizations:** they choose **Business** (the default) or **Non-profit**. Choosing non-profit sends an NPO request with a short description, for QC to review.

Every account already starts on its default type (Starter or Business), so skipping or leaving this step never breaks anything.

## Changing account type

| From → To | How | When it takes effect | Payment |
|---|---|---|---|
| Starter → Premium / VIP / Freelance | Settings → Plan → Upgrade, with PIN | Immediately | Full monthly price from the wallet, then every 30 days |
| Paid plan → more expensive plan | Settings → Plan → Upgrade, with PIN | Immediately | Full price of the new plan (no credit for unused days) |
| Paid plan → cheaper plan or Starter | Settings → Plan → Switch | At the end of the paid period | Nothing now |
| Cancel a paid plan | Settings → Plan → Cancel auto-renewal | Plan stays until the period ends, then Starter | Nothing |
| Business → NPO | Organization sends a request (signup step or Settings → Plan); a QC admin approves | When approved | Free |
| Anything → Agent, Business terms | QC admin | Immediately | No billing |

**When a renewal fails:** if the wallet doesn't have enough money on the renewal date, the plan is marked **overdue**. The user keeps it for **3 days** while QC retries every hour. If the wallet is still short after that, the account goes back to Starter. The user gets a notification at each step.

**Adding money:** the wallet is filled through **Top up** on the home screen, from MTN MoMo or Airtel Money. During development the top-up is simulated; no real money moves.

---

## What is enforced today

**Enforced:**
- daily limits;
- the yes/no access to features in the table above, for every payment flow in the app;
- action creation limited to Business and NPO;
- monthly plan billing and renewals.

**Listed but not active yet:**
- **115 RWF fees:** shown everywhere, charged only once `FEES_ENABLED` is switched on.
- **Instant transfer fee:** every transfer is already instant, so there is nothing to charge.

**In the spec but not built yet:**
- multi-currency;
- second QC;
- category creation;
- auto-acknowledgement;
- financial advice;
- transfer tracking history;
- AI chatbot, employee management and product management;
- support levels per account type;
- enforcement of payment amount setting, storing information and receiving any type of money.
