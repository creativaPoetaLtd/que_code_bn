# Group Chat Demo Setup Guide

## Overview
This guide helps you set up demo data for testing the group chat functionality with the two specified users.

## Demo Users
- **User 1**: kananuraabdulkhaliq59@gmail.com (Group Owner)
- **User 2**: kananura221023924@gmail.com (Group Member)
- **User 3**: admin@demo.com (Group Admin - for admin testing)

**Default Password for all demo users**: `demo123`

## Quick Setup Steps

### 1. Execute the SQL file
Run the complete SQL file to insert all demo data:
```bash
psql -d your_database_name -f demo-chat-data.sql
```

### 2. Verify Data Insertion
Check if users were created:
```sql
SELECT id, "firstName", "lastName", email, "isVerified", "approvalStatus" 
FROM "Users" 
WHERE email IN ('kananuraabdulkhaliq59@gmail.com', 'kananura221023924@gmail.com', 'admin@demo.com');
```

Check groups and their members:
```sql
SELECT g.name, g.description, g."isPrivate", g."memberCount", u."firstName" || ' ' || u."lastName" as owner_name 
FROM "Groups" g 
JOIN "Users" u ON g."ownerId" = u.id;
```

### 3. Test Authentication
Use your login endpoint to get JWT tokens for the demo users:

```bash
# Login as User 1
POST /api/auth/login
{
  "email": "kananuraabdulkhaliq59@gmail.com",
  "password": "demo123"
}

# Login as User 2  
POST /api/auth/login
{
  "email": "kananura221023924@gmail.com",
  "password": "demo123"
}
```

## Demo Groups Created

### Group 1: "Demo Chat Group" (Public)
- **ID**: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- **Owner**: Kananura Abdul Khaliq
- **Members**: 3 (Owner, Member, Admin)
- **Settings**: Relaxed (file sharing, money transfers allowed)

### Group 2: "Study Group" (Private)
- **ID**: `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- **Owner**: Kananura Student
- **Members**: 2 (Owner, Member)
- **Settings**: Strict (limited file types, no money transfers)

## Testing Scenarios

### 1. Basic Chat Operations
```bash
# Get group chat details
GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat
Authorization: Bearer YOUR_JWT_TOKEN

# Get messages (with pagination)
GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages?page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN

# Send a new message
POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages
Authorization: Bearer YOUR_JWT_TOKEN
{
  "content": "Hello from the API test!",
  "messageType": "text"
}
```

### 2. Message Management
```bash
# Edit a message (use existing message ID from demo data)
PUT /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages/msg77777-7777-7777-7777-777777777777
Authorization: Bearer YOUR_JWT_TOKEN
{
  "content": "This is the edited message content"
}

# Delete a message
DELETE /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages/msg77777-7777-7777-7777-777777777777
Authorization: Bearer YOUR_JWT_TOKEN
```

### 3. Read Receipts
```bash
# Mark messages as read
POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/read
Authorization: Bearer YOUR_JWT_TOKEN
{
  "messageIds": ["msg55555-5555-5555-5555-555555555555", "msg66666-6666-6666-6666-666666666666"]
}
```

### 4. Chat Settings
```bash
# Get current chat settings
GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/settings
Authorization: Bearer YOUR_JWT_TOKEN

# Update chat settings (Owner/Admin only)
PUT /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/settings
Authorization: Bearer YOUR_JWT_TOKEN
{
  "allowFileSharing": false,
  "slowMode": 30,
  "onlyAdminsCanPost": true
}
```

### 5. File Upload
```bash
# Upload a file
POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/upload
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data
# Include file in form data
```

### 6. Advanced Message Types
```bash
# Send a reply message
POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages
Authorization: Bearer YOUR_JWT_TOKEN
{
  "content": "This is a reply to your message",
  "messageType": "text",
  "replyToMessageId": "msg55555-5555-5555-5555-555555555555"
}

# Send an announcement (Admin/Owner only)
POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages
Authorization: Bearer YOUR_JWT_TOKEN
{
  "content": "📢 Important announcement for all members!",
  "messageType": "announcement",
  "metadata": {"priority": "high", "pinned": true}
}
```

## Expected Demo Message Flow

The demo data includes a realistic conversation flow:

1. **Welcome message** from group owner
2. **Reply** from second user
3. **Admin announcement** with metadata
4. **File sharing** example with metadata
5. **Recent casual messages** 
6. **Edited message** example
7. **Private study group** messages

## Verification Queries

### Check message history:
```sql
SELECT 
  cm.content, 
  cm."messageType", 
  u."firstName" || ' ' || u."lastName" as sender, 
  g.name as group_name, 
  cm."createdAt",
  cm."isEdited"
FROM "ChatMessages" cm
JOIN "Chats" c ON cm."chatId" = c.id
JOIN "Groups" g ON c."groupId" = g.id
JOIN "Users" u ON cm."senderId" = u.id
ORDER BY cm."createdAt" DESC
LIMIT 10;
```

### Check read receipts:
```sql
SELECT 
  cm.content,
  cm."readBy",
  u."firstName" || ' ' || u."lastName" as sender
FROM "ChatMessages" cm
JOIN "Users" u ON cm."senderId" = u.id
WHERE cm."chatId" = 'chat1111-1111-1111-1111-111111111111'
ORDER BY cm."createdAt" DESC;
```

### Check group settings:
```sql
SELECT 
  g.name,
  gcs."allowFileSharing",
  gcs."allowMoneyTransfers",
  gcs."onlyAdminsCanPost",
  gcs."slowMode"
FROM "Groups" g
JOIN "GroupChatSettings" gcs ON g.id = gcs."groupId";
```

## Troubleshooting

### If users don't exist:
Make sure you've run the user creation queries first.

### If authentication fails:
The password hash is for "demo123". If you're using a different hashing method, update the password field accordingly.

### If groups don't appear:
Check that the group creation queries ran successfully and that the foreign key constraints are satisfied.

### If messages don't show:
Verify that the chat records were created and that the chatId references are correct.

## Next Steps

After setting up the demo data:

1. Test each endpoint with different user tokens
2. Verify role-based permissions (owner, admin, member)
3. Test error scenarios (unauthorized access, invalid IDs)
4. Check real-time updates if you have WebSocket implementation
5. Test file upload with actual files
6. Verify notification system integration

## Demo User IDs for JWT Payload

When creating JWT tokens, use these user IDs:
- **Kananura Abdul Khaliq**: `11111111-1111-1111-1111-111111111111`
- **Kananura Student**: `22222222-2222-2222-2222-222222222222`
- **Demo Admin**: `33333333-3333-3333-3333-333333333333`