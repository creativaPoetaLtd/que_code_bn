# Gallery Upload Guide for Frontend

Last updated: 2026-04-20

This document describes the gallery upload and management flow for the welcome page frontend.

## Overview

Gallery images now come from two sources:

1. Dedicated gallery uploads
2. Existing profile/action media already surfaced by the backend

The frontend should use the dedicated upload endpoints for user-added images.

## Upload Endpoints

### Profile gallery upload

`POST /profiles/:userId/gallery`

Auth required.

Form-data fields:

- `image` - required image file
- `caption` - optional text

Example response:

```json
{
  "message": "Gallery image uploaded successfully",
  "item": {
    "id": "uuid",
    "imageUrl": "https://res.cloudinary.com/...",
    "caption": "Summer event",
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
}
```

### Organization gallery upload

`POST /organizations/:orgId/gallery`

Auth required.

Form-data fields:

- `image` - required image file
- `caption` - optional text

Example response:

```json
{
  "message": "Gallery image uploaded successfully",
  "item": {
    "id": "uuid",
    "imageUrl": "https://res.cloudinary.com/...",
    "caption": "Team photo",
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
}
```

## Read Endpoints

### Profile gallery

`GET /profiles/:userId/gallery`

Returns:

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

### Organization gallery

`GET /organizations/:orgId/gallery`

Returns the same shape as profile gallery.

## Update Endpoints

### Update profile gallery item

`PUT /profiles/:userId/gallery/:itemId`

Auth required.

Form-data fields:

- `image` - optional replacement image file
- `caption` - optional replacement caption

Behavior:

- If `image` is provided, the backend replaces the old Cloudinary image.
- If `caption` is provided, only the caption updates.
- At least one field must be provided.

### Update organization gallery item

`PUT /organizations/:orgId/gallery/:itemId`

Same behavior as the profile endpoint.

## Delete Endpoints

### Delete profile gallery item

`DELETE /profiles/:userId/gallery/:itemId`

Auth required.

### Delete organization gallery item

`DELETE /organizations/:orgId/gallery/:itemId`

Auth required.

## Recommended Frontend Flow

1. Load gallery with the GET endpoint.
2. Show an upload button only for authorized users.
3. Submit uploads as `multipart/form-data`.
4. After upload/update/delete, refetch the gallery list.
5. Sort locally by `createdAt` only if needed, but backend already returns newest-first.

## Authorization Notes

- Profile gallery upload/update/delete is allowed for the same user or admin.
- Organization gallery upload/update/delete is allowed for the organization owner context, org-scoped users, or admin.
- Public gallery reads do not require auth.

## File Validation

- Images only.
- Maximum size: 10MB.
- Accepted extensions are image formats such as `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `tiff`, `jfif`, and `tif`.

## UI Recommendation

A simple gallery editor can support:

- drag-and-drop upload
- caption input
- edit caption modal
- replace image action
- delete confirmation dialog

This keeps the welcome-page content manageable without requiring a separate admin screen.
