const { Client } = require("pg");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

async function createTestUser() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    database: "que_code_devs",
    user: "postgres",
    password: "postgres",
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM "Users" WHERE email = $1',
      ["yvetteizanyibuka@huzalabs.com"]
    );

    if (existingUser.rows.length > 0) {
      console.log("🔍 User already exists:", existingUser.rows[0]);
      return existingUser.rows[0];
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("Test@123", 12);
    const userId = uuidv4();

    // Insert user
    const userResult = await client.query(
      `
      INSERT INTO "Users" (id, "firstName", "lastName", email, password, "isVerified", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, "firstName", "lastName", email, "isVerified"
    `,
      [
        userId,
        "Yvette",
        "Izanyibuka",
        "yvetteizanyibuka@huzalabs.com",
        hashedPassword,
        true,
      ]
    );

    console.log("✅ User created successfully:", userResult.rows[0]);

    // Create profile
    const profileId = uuidv4();
    await client.query(
      `
      INSERT INTO "Profiles" (id, "userId", "profilePicture", "bio", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
    `,
      [profileId, userId, null, "Test user for invitation system"]
    );

    console.log("✅ Profile created successfully");

    return userResult.rows[0];
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

createTestUser();
