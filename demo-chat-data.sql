-- Demo Data for Group Chat Testing
-- This file contains SQL queries to insert demo data for testing group chat functionality

-- =====================================================
-- 1. INSERT DEMO USERS
-- =====================================================

-- User 1: Kananura Abdul Khaliq
INSERT INTO "Users" (
    id, 
    "firstName", 
    "lastName", 
    email, 
    phone, 
    password, 
    "isVerified", 
    "approvalStatus", 
    "createdAt", 
    "updatedAt"
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Kananura',
    'Abdul Khaliq',
    'kananuraabdulkhaliq59@gmail.com',
    '+256700123456',
    '$2b$10$YtZlzcKfgXRkJMwd..YwT.rOUC0Ys3aBCuTrusQJ7ioF9udcfUqc2
', -- password: "demo123"
    true,
    true,
    NOW(),
    NOW()
);

-- User 2: Kananura Student
INSERT INTO "Users" (
    id, 
    "firstName", 
    "lastName", 
    email, 
    phone, 
    password, 
    "isVerified", 
    "approvalStatus", 
    "createdAt", 
    "updatedAt"
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Kananura',
    'Student',
    'kananura221023924@gmail.com',
    '+256700654321',
    '$2b$10$YtZlzcKfgXRkJMwd..YwT.rOUC0Ys3aBCuTrusQJ7ioF9udcfUqc2
', -- password: "demo123"
    true,
    true,
    NOW(),
    NOW()
);

-- User 3: Demo Admin (for admin testing)
INSERT INTO "Users" (
    id, 
    "firstName", 
    "lastName", 
    email, 
    phone, 
    password, 
    "isVerified", 
    "approvalStatus", 
    "createdAt", 
    "updatedAt"
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Demo',
    'Admin',
    'admin@demo.com',
    '+256700111222',
    '$2b$10$YtZlzcKfgXRkJMwd..YwT.rOUC0Ys3aBCuTrusQJ7ioF9udcfUqc2
', -- password: "demo123"
    true,
    true,
    NOW(),
    NOW()
);

-- =====================================================
-- 2. INSERT DEMO GROUPS
-- =====================================================

-- Group 1: Public Demo Group
INSERT INTO "Groups" (
    id,
    name,
    description,
    picture,
    "ownerId",
    "qrCode",
    "accessLink",
    "accessToken",
    "isPrivate",
    "maxMembers",
    "memberCount",
    "lifeTime",
    "createdAt",
    "updatedAt"
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Demo Chat Group',
    'A demo group for testing chat functionality',
    'https://via.placeholder.com/150x150.png?text=Demo+Group',
    '11111111-1111-1111-1111-111111111111',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'https://demo.app/join/demo-chat-group',
    'demo-access-token-123',
    false,
    50,
    3,
    365,
    NOW(),
    NOW()
);

-- Group 2: Private Study Group
INSERT INTO "Groups" (
    id,
    name,
    description,
    picture,
    "ownerId",
    "qrCode",
    "accessLink",
    "accessToken",
    "isPrivate",
    "maxMembers",
    "memberCount",
    "lifeTime",
    "createdAt",
    "updatedAt"
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Study Group',
    'Private study group for academic discussions',
    'https://via.placeholder.com/150x150.png?text=Study+Group',
    '22222222-2222-2222-2222-222222222222',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'https://demo.app/join/study-group',
    'study-access-token-456',
    true,
    20,
    2,
    180,
    NOW(),
    NOW()
);

-- =====================================================
-- 3. INSERT GROUP MEMBERS
-- =====================================================

-- Group 1 Members
-- Owner
INSERT INTO "GroupMembers" (
    id,
    "groupId",
    "userId",
    role,
    status,
    "invitedBy",
    "joinedAt",
    "invitedAt",
    "respondedAt",
    "lastReadAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'mem11111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    'active',
    NULL,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '2 days',
    NOW()
);

-- Member 2
INSERT INTO "GroupMembers" (
    id,
    "groupId",
    "userId",
    role,
    status,
    "invitedBy",
    "joinedAt",
    "invitedAt",
    "respondedAt",
    "lastReadAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'mem22222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'member',
    'active',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day 2 hours',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '5 minutes',
    NOW() - INTERVAL '1 day 2 hours',
    NOW()
);

-- Admin Member
INSERT INTO "GroupMembers" (
    id,
    "groupId",
    "userId",
    role,
    status,
    "invitedBy",
    "joinedAt",
    "invitedAt",
    "respondedAt",
    "lastReadAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'mem33333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'admin',
    'active',
    '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '1 day 12 hours',
    NOW() - INTERVAL '1 day 14 hours',
    NOW() - INTERVAL '1 day 12 hours',
    NOW() - INTERVAL '2 minutes',
    NOW() - INTERVAL '1 day 14 hours',
    NOW()
);

-- Group 2 Members (Study Group)
-- Owner
INSERT INTO "GroupMembers" (
    id,
    "groupId",
    "userId",
    role,
    status,
    "invitedBy",
    "joinedAt",
    "invitedAt",
    "respondedAt",
    "lastReadAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'mem44444-4444-4444-4444-444444444444',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'owner',
    'active',
    NULL,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '3 days',
    NOW()
);

-- Member
INSERT INTO "GroupMembers" (
    id,
    "groupId",
    "userId",
    role,
    status,
    "invitedBy",
    "joinedAt",
    "invitedAt",
    "respondedAt",
    "lastReadAt",
    "createdAt",
    "updatedAt"
) VALUES (
    'mem55555-5555-5555-5555-555555555555',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'member',
    'active',
    '22222222-2222-2222-2222-222222222222',
    NOW() - INTERVAL '2 days 12 hours',
    NOW() - INTERVAL '2 days 14 hours',
    NOW() - INTERVAL '2 days 12 hours',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '2 days 14 hours',
    NOW()
);

-- =====================================================
-- 4. INSERT CHATS (for groups)
-- =====================================================

-- Chat for Group 1
INSERT INTO "Chats" (
    id,
    "isGroup",
    "groupId",
    "createdAt",
    "updatedAt"
) VALUES (
    'chat1111-1111-1111-1111-111111111111',
    true,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NOW() - INTERVAL '2 days',
    NOW()
);

-- Chat for Group 2
INSERT INTO "Chats" (
    id,
    "isGroup",
    "groupId",
    "createdAt",
    "updatedAt"
) VALUES (
    'chat2222-2222-2222-2222-222222222222',
    true,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    NOW() - INTERVAL '3 days',
    NOW()
);

-- =====================================================
-- 5. INSERT GROUP CHAT SETTINGS
-- =====================================================

-- Settings for Group 1 (Relaxed settings)
INSERT INTO "GroupChatSettings" (
    id,
    "groupId",
    "canMembersInvite",
    "canMembersDeleteMessages",
    "onlyAdminsCanPost",
    "messageRetentionDays",
    "allowFileSharing",
    "allowMoneyTransfers",
    "maxFileSize",
    "allowedFileTypes",
    "profanityFilter",
    "linkPreview",
    "readReceipts",
    "typingIndicators",
    "slowMode",
    "announcementMode",
    "createdAt",
    "updatedAt"
) VALUES (
    'sets1111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    true,
    false,
    false,
    90,
    true,
    true,
    10485760,
    '["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "txt", "mp4", "mp3"]',
    false,
    true,
    true,
    true,
    NULL,
    false,
    NOW() - INTERVAL '2 days',
    NOW()
);

-- Settings for Group 2 (Strict settings)
INSERT INTO "GroupChatSettings" (
    id,
    "groupId",
    "canMembersInvite",
    "canMembersDeleteMessages",
    "onlyAdminsCanPost",
    "messageRetentionDays",
    "allowFileSharing",
    "allowMoneyTransfers",
    "maxFileSize",
    "allowedFileTypes",
    "profanityFilter",
    "linkPreview",
    "readReceipts",
    "typingIndicators",
    "slowMode",
    "announcementMode",
    "createdAt",
    "updatedAt"
) VALUES (
    'sets2222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    false,
    false,
    false,
    30,
    true,
    false,
    5242880,
    '["jpg", "jpeg", "png", "pdf", "txt"]',
    true,
    false,
    true,
    false,
    10,
    false,
    NOW() - INTERVAL '3 days',
    NOW()
);

-- =====================================================
-- 6. INSERT CHAT MESSAGES
-- =====================================================

-- Messages for Group 1 (Demo Chat Group)
-- Welcome message from owner
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg11111-1111-1111-1111-111111111111',
    'chat1111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Welcome to our demo chat group! Feel free to test all chat features here.',
    'text',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    '[{"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '2 days')::text || '"}, {"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '1 day 23 hours')::text || '"}, {"userId": "33333333-3333-3333-3333-333333333333", "readAt": "' || (NOW() - INTERVAL '1 day 22 hours')::text || '"}]',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
);

-- Response from second user
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg22222-2222-2222-2222-222222222222',
    'chat1111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'Thanks for the warm welcome! This looks like a great platform for group discussions.',
    'text',
    NULL,
    NULL,
    'msg11111-1111-1111-1111-111111111111',
    false,
    NULL,
    '[{"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '1 day 22 hours')::text || '"}, {"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '1 day 21 hours')::text || '"}, {"userId": "33333333-3333-3333-3333-333333333333", "readAt": "' || (NOW() - INTERVAL '1 day 20 hours')::text || '"}]',
    NOW() - INTERVAL '1 day 22 hours',
    NOW() - INTERVAL '1 day 22 hours'
);

-- Admin announcement
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg33333-3333-3333-3333-333333333333',
    'chat1111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    '📢 Important: Please remember to follow group guidelines and be respectful to all members.',
    'announcement',
    NULL,
    '{"priority": "high", "pinned": true}',
    NULL,
    false,
    NULL,
    '[{"userId": "33333333-3333-3333-3333-333333333333", "readAt": "' || (NOW() - INTERVAL '1 day 12 hours')::text || '"}, {"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '1 day 11 hours')::text || '"}, {"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '1 day 10 hours')::text || '"}]',
    NOW() - INTERVAL '1 day 12 hours',
    NOW() - INTERVAL '1 day 12 hours'
);

-- File sharing example
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg44444-4444-4444-4444-444444444444',
    'chat1111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Check out this demo document I shared!',
    'file',
    NULL,
    '{"fileName": "demo_document.pdf", "fileSize": 1024567, "fileUrl": "https://demo.app/files/demo_document.pdf", "mimeType": "application/pdf"}',
    NULL,
    false,
    NULL,
    '[{"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '12 hours')::text || '"}, {"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '10 hours')::text || '"}]',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
);

-- Recent messages
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg55555-5555-5555-5555-555555555555',
    'chat1111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'Hey everyone! How are you all doing today? 😊',
    'text',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    '[{"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '30 minutes')::text || '"}, {"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '25 minutes')::text || '"}]',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
);

INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg66666-6666-6666-6666-666666666666',
    'chat1111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Doing great! Testing the chat functionality and it works perfectly.',
    'text',
    NULL,
    NULL,
    'msg55555-5555-5555-5555-555555555555',
    false,
    NULL,
    '[{"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '20 minutes')::text || '"}]',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
);

-- Edited message example
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg77777-7777-7777-7777-777777777777',
    'chat1111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'This message has been edited to fix a typo! ✏️',
    'text',
    NULL,
    NULL,
    NULL,
    true,
    NOW() - INTERVAL '5 minutes',
    '[{"userId": "33333333-3333-3333-3333-333333333333", "readAt": "' || (NOW() - INTERVAL '15 minutes')::text || '"}]',
    NOW() - INTERVAL '15 minutes',
    NOW() - INTERVAL '5 minutes'
);

-- Messages for Group 2 (Study Group)
INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg88888-8888-8888-8888-888888888888',
    'chat2222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'Welcome to our study group! Let''s focus on academic discussions and help each other learn.',
    'text',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    '[{"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '3 days')::text || '"}, {"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '2 days 22 hours')::text || '"}]',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
);

INSERT INTO "ChatMessages" (
    id,
    "chatId",
    "senderId",
    content,
    "messageType",
    "transactionId",
    metadata,
    "replyToMessageId",
    "isEdited",
    "editedAt",
    "readBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'msg99999-9999-9999-9999-999999999999',
    'chat2222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Great idea! I have some study materials I can share with everyone.',
    'text',
    NULL,
    NULL,
    'msg88888-8888-8888-8888-888888888888',
    false,
    NULL,
    '[{"userId": "11111111-1111-1111-1111-111111111111", "readAt": "' || (NOW() - INTERVAL '2 days 20 hours')::text || '"}, {"userId": "22222222-2222-2222-2222-222222222222", "readAt": "' || (NOW() - INTERVAL '2 days 18 hours')::text || '"}]',
    NOW() - INTERVAL '2 days 20 hours',
    NOW() - INTERVAL '2 days 20 hours'
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- To verify the data was inserted correctly, run these queries:

-- Check users
-- SELECT id, "firstName", "lastName", email, "isVerified", "approvalStatus" FROM "Users" WHERE email IN ('kananuraabdulkhaliq59@gmail.com', 'kananura221023924@gmail.com', 'admin@demo.com');

-- Check groups and their members
-- SELECT g.name, g.description, g."isPrivate", g."memberCount", u."firstName" || ' ' || u."lastName" as owner_name 
-- FROM "Groups" g 
-- JOIN "Users" u ON g."ownerId" = u.id;

-- Check group members with roles
-- SELECT g.name as group_name, u."firstName" || ' ' || u."lastName" as member_name, gm.role, gm.status
-- FROM "GroupMembers" gm
-- JOIN "Groups" g ON gm."groupId" = g.id
-- JOIN "Users" u ON gm."userId" = u.id
-- ORDER BY g.name, gm.role;

-- Check recent messages
-- SELECT cm.content, cm."messageType", u."firstName" || ' ' || u."lastName" as sender, g.name as group_name, cm."createdAt"
-- FROM "ChatMessages" cm
-- JOIN "Chats" c ON cm."chatId" = c.id
-- JOIN "Groups" g ON c."groupId" = g.id
-- JOIN "Users" u ON cm."senderId" = u.id
-- ORDER BY cm."createdAt" DESC
-- LIMIT 10;

-- =====================================================
-- TESTING SCENARIOS COVERED
-- =====================================================

-- 1. ✅ Two main users for testing
-- 2. ✅ Public and private groups
-- 3. ✅ Different member roles (owner, admin, member)
-- 4. ✅ Various message types (text, file, announcement)
-- 5. ✅ Message replies and editing
-- 6. ✅ Read receipts and timestamps
-- 7. ✅ Group chat settings (different configurations)
-- 8. ✅ Recent and historical messages
-- 9. ✅ Member activity tracking (lastReadAt)
-- 10. ✅ File sharing metadata example

-- =====================================================
-- API TESTING ENDPOINTS TO TRY
-- =====================================================

-- With this data, you can test:
-- GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat
-- GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages
-- POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages
-- PUT /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages/msg77777-7777-7777-7777-777777777777
-- DELETE /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/messages/msg77777-7777-7777-7777-777777777777
-- POST /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/read
-- GET /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/settings
-- PUT /api/groups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/chat/settings

-- Authentication: Use JWT tokens for the demo users
-- User IDs for testing:
-- Kananura Abdul Khaliq: 11111111-1111-1111-1111-111111111111
-- Kananura Student: 22222222-2222-2222-2222-222222222222
-- Demo Admin: 33333333-3333-3333-3333-333333333333