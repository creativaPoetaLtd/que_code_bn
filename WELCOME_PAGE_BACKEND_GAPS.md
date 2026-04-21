# Welcome Page — Backend API Gaps

Last updated: 2026-04-20

Purpose: this file is strictly for backend work needed by `/welcome/[userId]`.

Only missing backend APIs/fields are listed below.

---

## 1. Profile Social Links

### Required response addition

The profile payload returned by:

```
GET /profiles?userId=<id>&organizationId=<id>
```

should include:

```json
{
  "socialLinks": {
    "instagram": "https://instagram.com/...",
    "facebook": "https://facebook.com/...",
    "twitter": "https://twitter.com/...",
    "linkedin": "https://linkedin.com/..."
  }
}
```

### Notes for backend

- Return empty strings or omit keys consistently when not configured.
- Validate URLs server-side before persisting.

### Status

✅ Implemented

---

## 2. Gallery Endpoints

### Required endpoints

```
GET /profiles/:userId/gallery
GET /organizations/:orgId/gallery
```

### Expected response

```json
{
  "items": [
    {
      "id": "string",
      "imageUrl": "string",
      "caption": "string",
      "createdAt": "ISO-8601"
    }
  ]
}
```

### Notes for backend

- Public read access is acceptable for welcome page usage.
- Return newest-first ordering.

### Status

✅ Implemented

---

## 3. Organization Stats Endpoint

### Required endpoint

```
GET /organizations/:orgId/stats
```

### Expected response

```json
{
  "scansThisWeek": 0,
  "totalBookings": 0,
  "audienceRating": 0,
  "liveActionsCount": 0
}
```

### Notes for backend

- `audienceRating` should be numeric in range 0-5.
- Keep field names stable; frontend will map directly.

### Status

✅ Implemented

---

## 4. Public Actions: minPrice Field

### Required response addition

The list returned by:

```
GET /organizations/:id/actions/public
```

should include on each action:

```json
{
  "minPrice": "45.00",
  "currency": "EUR"
}
```

### Notes for backend

- `minPrice` = lowest active sub-action price for that action.
- Keep `currency` consistent with action/sub-actions currency rules.

### Status

✅ Implemented

---

## 5. Operational Document Exposure Policy

### Decision required

`operationalDocument` is present in profile data, but backend policy should be explicit:

- Is this field public on welcome profiles?
- If sensitive, should it be hidden unless authenticated/authorized?

### Status

✅ Implemented

### Implemented policy

- `operationalDocument` is hidden from public profile reads.
- It is only included when the request is authenticated.

---

## Backend Summary

| Item | API / Contract | Backend status |
|---|---|---|
| Social links in profile | Add `socialLinks` to profile response | ✅ Implemented |
| Profile gallery | `GET /profiles/:userId/gallery` | ✅ Implemented |
| Organization gallery | `GET /organizations/:orgId/gallery` | ✅ Implemented |
| Organization stats | `GET /organizations/:orgId/stats` | ✅ Implemented |
| Action card min price | Add `minPrice` (+ currency consistency) in actions/public response | ✅ Implemented |
| operationalDocument policy | Hide on public profile; expose only when authenticated | ✅ Implemented |
