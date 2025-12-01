-- Check ChatParticipants table to see lastReadAt values
SELECT 
    cp.id,
    cp."chatId",
    cp."userId",
    u."firstName",
    u."lastName",
    cp."lastReadAt",
    cp."joinedAt"
FROM "ChatParticipants" cp
JOIN "Users" u ON u.id = cp."userId"
ORDER BY cp."joinedAt" DESC
LIMIT 20;

-- Check messages in a specific chat with timestamps
SELECT 
    cm.id,
    cm."chatId",
    cm."senderId",
    u."firstName" || ' ' || u."lastName" as sender_name,
    cm.content,
    cm."messageType",
    cm."createdAt",
    cm.status
FROM "ChatMessages" cm
JOIN "Users" u ON u.id = cm."senderId"
ORDER BY cm."createdAt" DESC
LIMIT 20;

-- Calculate unread count for a specific user in a specific chat
-- Replace 'YOUR_USER_ID' and 'CHAT_ID' with actual UUIDs
WITH user_participant AS (
    SELECT "lastReadAt" 
    FROM "ChatParticipants"
    WHERE "userId" = 'YOUR_USER_ID' AND "chatId" = 'CHAT_ID'
)
SELECT COUNT(*) as unread_count
FROM "ChatMessages" cm
CROSS JOIN user_participant up
WHERE cm."chatId" = 'CHAT_ID'
  AND cm."senderId" != 'YOUR_USER_ID'
  AND (
    up."lastReadAt" IS NULL 
    OR cm."createdAt" > up."lastReadAt"
  );
