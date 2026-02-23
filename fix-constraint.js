require('dotenv').config();
const { Client } = require('pg');

const fixConstraint = async () => {
  const client = new Client(process.env.DB_DEV_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Drop the incorrect constraint
    await client.query('ALTER TABLE "WalletRestrictions" DROP CONSTRAINT IF EXISTS "WalletRestrictions_categoryId_fkey"');
    console.log('✅ Dropped old constraint');
    
    // Add the correct constraint
    await client.query('ALTER TABLE "WalletRestrictions" ADD CONSTRAINT "WalletRestrictions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Categories" ("id") ON DELETE NO ACTION ON UPDATE CASCADE');
    console.log('✅ Added new constraint pointing to Categories table');
    
    // Verify
    const result = await client.query(`
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
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'categoryId'
    `);
    
    console.log('\n✅ Constraint verification:');
    console.table(result.rows);
    
    await client.end();
    console.log('\n✅ All done! Please restart your server.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
};

fixConstraint();
