-- Database Verification Script
-- Run these queries to check what data exists in your database

-- =====================================================
-- 1. CHECK USERS
-- =====================================================
SELECT 
    id, 
    "firstName", 
    "lastName", 
    email, 
    "isVerified", 
    "approvalStatus"
FROM "Users" 
WHERE email IN (
    'kananuraabdulkhaliq59@gmail.com', 
    'kananura221023924@gmail.com', 
    'admin@demo.com'
);

-- =====================================================
-- 2. CHECK GROUPS
-- =====================================================
SELECT 
    id,
    name,
    description,
    "ownerId",
    "isPrivate",
    "memberCount"
FROM "Groups";

-- =====================================================
-- 3. CHECK GROUP MEMBERS
-- =====================================================
SELECT 
    gm.id,
    g.name as group_name,
    u."firstName" || ' ' || u."lastName" as member_name,
    u.email,
    gm.role,
    gm.status,
    gm."joinedAt"
FROM "GroupMembers" gm
JOIN "Groups" g ON gm."groupId" = g.id
JOIN "Users" u ON gm."userId" = u.id
ORDER BY g.name, gm.role DESC;

-- =====================================================
-- 4. CHECK CHATS
-- =====================================================
SELECT 
    c.id,
    c."isGroup",
    g.name as group_name
FROM "Chats" c
LEFT JOIN "Groups" g ON c."groupId" = g.id;

-- =====================================================
-- 5. CHECK GROUP CHAT SETTINGS
-- =====================================================
SELECT 
    gcs.*,
    g.name as group_name
FROM "GroupChatSettings" gcs
JOIN "Groups" g ON gcs."groupId" = g.id;

-- =====================================================
-- 6. CHECK MESSAGES COUNT
-- =====================================================
SELECT 
    COUNT(*) as message_count,
    g.name as group_name
FROM "ChatMessages" cm
JOIN "Chats" c ON cm."chatId" = c.id
JOIN "Groups" g ON c."groupId" = g.id
GROUP BY g.id, g.name;

-- =====================================================
-- 7. SPECIFIC USER GROUP MEMBERSHIP CHECK
-- =====================================================
-- This is the key query to check if your users are members of groups
SELECT 
    u.email as user_email,
    g.name as group_name,
    g.id as group_id,
    gm.role,
    gm.status,
    gm.id as membership_id
FROM "Users" u
LEFT JOIN "GroupMembers" gm ON u.id = gm."userId"
LEFT JOIN "Groups" g ON gm."groupId" = g.id
WHERE u.email IN ('kananuraabdulkhaliq59@gmail.com', 'kananura221023924@gmail.com')
ORDER BY u.email, g.name;