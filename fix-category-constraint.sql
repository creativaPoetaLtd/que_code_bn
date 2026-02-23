-- Fix WalletRestrictions foreign key to point to Categories instead of TransactionCategories

-- First, drop the incorrect constraint
ALTER TABLE "WalletRestrictions" 
DROP CONSTRAINT IF EXISTS "WalletRestrictions_categoryId_fkey";

-- Add the correct constraint pointing to Categories
ALTER TABLE "WalletRestrictions" 
ADD CONSTRAINT "WalletRestrictions_categoryId_fkey" 
FOREIGN KEY ("categoryId") REFERENCES "Categories" ("id") 
ON DELETE NO ACTION ON UPDATE CASCADE;

-- Verify the constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'WalletRestrictions' 
  AND tc.constraint_type = 'FOREIGN KEY';
