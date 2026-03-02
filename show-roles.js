require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbUrl = process.env.DB_PROD_URL;
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function main() {
  try {
    const [roles] = await sequelize.query(`SELECT id, name FROM "Roles" ORDER BY name;`);
    console.log('Roles:');
    roles.forEach(r => console.log(`  ${r.name}: ${r.id}`));
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
