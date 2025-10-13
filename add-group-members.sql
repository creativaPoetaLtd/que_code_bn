-- Quick fix: Add Group Members for Demo Chat Testing
-- Run this if the main demo data didn't insert group members properly

-- =====================================================
-- PREREQUISITE CHECK - MAKE SURE USERS AND GROUPS EXIST
-- =====================================================

-- Verify users exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE id = '11111111-1111-1111-1111-111111111111') THEN
        RAISE EXCEPTION 'User kananuraabdulkhaliq59@gmail.com not found. Please run user creation SQL first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE id = '22222222-2222-2222-2222-222222222222') THEN
        RAISE EXCEPTION 'User kananura221023924@gmail.com not found. Please run user creation SQL first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE id = '33333333-3333-3333-3333-333333333333') THEN
        RAISE EXCEPTION 'User admin@demo.com not found. Please run user creation SQL first.';
    END IF;
END $$;

-- Verify groups exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "Groups" WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') THEN
        RAISE EXCEPTION 'Demo Chat Group not found. Please run group creation SQL first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM "Groups" WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') THEN
        RAISE EXCEPTION 'Study Group not found. Please run group creation SQL first.';
    END IF;
END $$;

-- First, let's check if the users and groups exist
-- If this returns empty, you need to run the user/group creation parts first

-- =====================================================
-- GROUP MEMBERS FOR DEMO GROUP 1 (Demo Chat Group)
-- =====================================================

-- Insert Owner (Kananura Abdul Khaliq)
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
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    'active',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '10 minutes',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Insert Member (Kananura Student)
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
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'member',
    'active',
    '11111111-1111-1111-1111-111111111111',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day 2 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '5 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 day 2 hours',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Insert Admin (Demo Admin)
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
    '33333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',
    'admin',
    'active',
    '11111111-1111-1111-1111-111111111111',
    CURRENT_TIMESTAMP - INTERVAL '1 day 12 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 day 14 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 day 12 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 minutes',
    CURRENT_TIMESTAMP - INTERVAL '1 day 14 hours',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- GROUP MEMBERS FOR DEMO GROUP 2 (Study Group)
-- =====================================================

-- Insert Owner (Kananura Student)
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
    '44444444-4444-4444-4444-444444444444',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'owner',
    'active',
    NULL,
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Insert Member (Kananura Abdul Khaliq)
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
    '55555555-5555-5555-5555-555555555555',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'member',
    'active',
    '22222222-2222-2222-2222-222222222222',
    CURRENT_TIMESTAMP - INTERVAL '2 days 12 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 days 14 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 days 12 hours',
    CURRENT_TIMESTAMP - INTERVAL '30 minutes',
    CURRENT_TIMESTAMP - INTERVAL '2 days 14 hours',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if group members were added successfully
SELECT 
    g.name as group_name,
    u."firstName" || ' ' || u."lastName" as member_name,
    gm.role,
    gm.status,
    gm."joinedAt"
FROM "GroupMembers" gm
JOIN "Groups" g ON gm."groupId" = g.id
JOIN "Users" u ON gm."userId" = u.id
ORDER BY g.name, gm.role DESC;

-- Check specific user memberships
SELECT 
    u.email,
    g.name as group_name,
    gm.role,
    gm.status
FROM "Users" u
JOIN "GroupMembers" gm ON u.id = gm."userId"
JOIN "Groups" g ON gm."groupId" = g.id
WHERE u.email IN ('kananuraabdulkhaliq59@gmail.com', 'kananura221023924@gmail.com')
ORDER BY u.email, g.name;