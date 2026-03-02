require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_PROD_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: true  // Enable logging
});

async function testRoleInsert() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected\n');
    
    const roleId = '11111111-1111-1111-1111-111111111111';
    const now = new Date().toISOString();
    
    const query = `INSERT INTO "Roles" ("id", "name", "description", "createdAt", "updatedAt")
           VALUES ('${roleId}', 'super_admin', 'Super Administrator with full system access', '${now}', '${now}')
           ON CONFLICT ("id") 
           DO UPDATE SET 
             "name" = EXCLUDED."name",
             "description" = EXCLUDED."description",
             "updatedAt" = EXCLUDED."updatedAt"`;
    
    console.log('Executing query:\n', query, '\n');
    
    const result = await sequelize.query(query);
    console.log('\n✅ Query executed. Result:', result);
    
    const [roles] = await sequelize.query(`SELECT * FROM "Roles";`);
    console.log('\nRoles in table:', roles);
    
    await sequelize.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

testRoleInsert();
