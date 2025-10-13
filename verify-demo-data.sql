-- Quick test to verify the fixes worked
-- Check if we can add group members now

-- Verify group members exist
SELECT 
    g.name as group_name,
    u."firstName" || ' ' || u."lastName" as member_name,
    gm.role,
    gm.status,
    gm."joinedAt"
FROM "GroupMembers" gm
JOIN "Groups" g ON gm."groupId" = g.id
JOIN "Users" u ON gm."userId" = u.id
WHERE g.id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ORDER BY g.name, gm.role DESC;

-- Check specific user memberships for the demo users
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

-- Count members per group
SELECT 
    g.name,
    COUNT(gm.id) as member_count,
    g."memberCount" as recorded_count
FROM "Groups" g
LEFT JOIN "GroupMembers" gm ON g.id = gm."groupId" AND gm.status = 'active'
GROUP BY g.id, g.name, g."memberCount"
ORDER BY g.name;