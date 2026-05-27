# Action Modal Types — Backend Requirements

This document describes the backend changes needed to support type-specific action modals (vote, ticket/buy, booking).

---

## Overview

Actions have a `type` field. The frontend now renders a different modal UI for each type. Each type requires specific fields in the `metadata` JSON column on both the `Action` and `SubAction` models.

All fields below are stored in the existing `metadata: JSON` column — **no schema migration is needed** as long as `metadata` is already a flexible JSON column on both tables.

---

## 1. Action-level `metadata`

When creating or updating an action, the frontend sends a `metadata` JSON object in the body of `POST /organizations/:id/actions` and `PUT /actions/:id`.

### Vote

```json
{
  "metadata": {
    "isLive": true,
    "closesAt": "23:00",
    "votesPerUser": 1
  }
}
```

| Field | Type | Description |
|---|---|---|
| `isLive` | boolean | Whether the vote is currently live (shows a live indicator) |
| `closesAt` | string (HH:MM) | Time the vote closes, displayed in the modal |
| `votesPerUser` | number | How many votes each user gets (usually 1) |

### Ticket (type = "ticket")

```json
{
  "metadata": {
    "schedule": "Saturday · 20:00",
    "venue": "Brussels Arena",
    "eventType": "Live concert",
    "accessMode": "Instant QR confirmation",
    "paymentMethod": "Automatic system routing"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `schedule` | string | Event date/time shown in the modal header |
| `venue` | string | Venue name shown as a badge |
| `eventType` | string | Shown in the info footer grid |
| `accessMode` | string | Shown in the info footer grid |
| `paymentMethod` | string | Shown in the info footer grid |
| `refundPolicy` | string | Shown in the info footer grid (optional, overrides policy.refund) |

### Booking

No required action-level metadata — booking-specific data lives on sub-actions.

---

## 2. SubAction-level `metadata`

When creating or updating a sub-action via `POST /actions/:id/sub-actions`, include typed metadata fields.

### Vote — Candidate sub-actions

Each sub-action represents one candidate.

```json
{
  "metadata": {
    "candidateNumber": "01",
    "badge": "Current trend · Strong support",
    "zone": "Main stage",
    "rank": 1,
    "votes": 3218
  }
}
```

| Field | Type | Set by | Description |
|---|---|---|---|
| `candidateNumber` | string | Organizer (wizard) | Displayed as "#01" next to the candidate name |
| `badge` | string | Organizer (wizard) | Short status text shown as a pill |
| `zone` | string | Organizer (wizard) | Zone/stage label in the stats grid |
| `rank` | number | Organizer or system | Current rank (1 = leading) |
| `votes` | number | **System (backend)** | Total votes received — **must be updated by the backend** each time a purchase is made for this sub-action |

> **Backend action required:** Every time a purchase is recorded for a vote sub-action, increment `metadata.votes` and recompute `metadata.rank` for all candidates in the same action.

### Ticket — Tier sub-actions

Each sub-action represents a ticket tier (Regular, VIP, VVIP, etc.).

```json
{
  "metadata": {
    "accessLabel": "Priority check-in",
    "highlights": [
      "Priority entrance",
      "Premium seating or premium standing area",
      "Exclusive event lane on arrival"
    ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `accessLabel` | string | Short tag shown on the tier card (e.g. "Most accessible", "Priority check-in") |
| `highlights` | string[] | Bullet-point list of tier benefits |

### Booking — Service sub-actions

Each sub-action represents a bookable service.

```json
{
  "metadata": {
    "duration": "2h 30m",
    "availableSlots": ["09:00", "11:30", "14:00", "17:00"],
    "locationOptions": ["Studio", "On-site", "With trial"],
    "maxPeople": 3,
    "category": "Bridal",
    "highlights": [
      "Consultation and skin prep",
      "Event-ready premium finish",
      "Direct QC booking confirmation"
    ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `duration` | string | Human-readable duration (e.g. "2h 30m") |
| `availableSlots` | string[] | List of available time slots for the service |
| `locationOptions` | string[] | Options the buyer can choose from (Studio, On-site, etc.) |
| `maxPeople` | number | Maximum number of people per booking |
| `category` | string | Service category (Bridal, Event, Hair, Photo) |
| `highlights` | string[] | What is included in this service |

---

## 3. Purchase API — Booking extra buyerData

When a booking is purchased, the frontend sends these additional fields in `buyerData`:

```json
{
  "subActionId": "...",
  "quantity": 2,
  "buyerId": "...",
  "buyerData": {
    "preferredDate": "2026-06-15",
    "preferredTime": "11:30",
    "people": "2 people",
    "notes": "Please prepare for outdoor setting.",
    "options": "On-site, With trial"
  }
}
```

| Field | Description |
|---|---|
| `preferredDate` | ISO date string selected by the buyer |
| `preferredTime` | Selected time slot (from `metadata.availableSlots`) |
| `people` | Human-readable people count |
| `notes` | Free text notes from the buyer |
| `options` | Comma-separated selected location options |

The backend should store these in the transaction/order record as booking details.

---

## 4. Vote purchase flow

For votes, the frontend always sends `quantity: 1` and `buyerData: {}` (no buyer fields required). The `userQuota` on the action should be set to `1` to enforce one vote per user.

```json
{
  "subActionId": "...",
  "quantity": 1,
  "buyerId": "...",
  "buyerData": {}
}
```

The backend should enforce:
- `userQuota` on the action (prevent double-voting)
- After a successful vote, increment `metadata.votes` on the sub-action
- Recompute `metadata.rank` for all sub-actions (candidates) in the same action, ordered by `metadata.votes` descending

---

## 5. API endpoints that need to accept `metadata`

| Method | Endpoint | Change |
|---|---|---|
| `POST` | `/organizations/:id/actions` | Accept `metadata` in body |
| `PUT` | `/actions/:id` | Accept and merge `metadata` in body |
| `POST` | `/actions/:id/sub-actions` | Accept `metadata` (already exists, ensure all fields pass through) |
| `PUT` | `/actions/:id/sub-actions/:subId` | Accept and merge `metadata` |
| `POST` | `/actions/:id/purchase` | After vote purchase: update `metadata.votes` + `metadata.rank` |

---

## 6. Public action endpoint

The `GET /organizations/:id/actions/public` response must include `metadata` on both the action and each sub-action object so the frontend can render type-specific UIs.

Ensure the response shape includes:
```json
{
  "id": "...",
  "type": "vote",
  "metadata": { "isLive": true, "closesAt": "23:00", "votesPerUser": 1 },
  ...
}
```

And for sub-actions via `GET /actions/:id/sub-actions`:
```json
{
  "id": "...",
  "metadata": { "candidateNumber": "01", "votes": 3218, "rank": 1, "zone": "Main stage", "badge": "Current trend · Strong support" },
  ...
}
```
