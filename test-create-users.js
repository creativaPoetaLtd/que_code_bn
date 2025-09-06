const fetch = require("node-fetch");

const API_URL = "http://localhost:3000/api/v1";

async function createTestUsers() {
  const users = [
    {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@test.com",
      phone: "+250123456789",
      password: "password123",
    },
    {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@test.com",
      phone: "+250123456790",
      password: "password123",
    },
  ];

  for (const user of users) {
    try {
      console.log(`Creating user: ${user.firstName} ${user.lastName}`);

      const response = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(
          `✅ User created: ${user.email} with ID: ${data.data?.id || data.id}`
        );
      } else {
        console.log(`❌ Failed to create user ${user.email}:`, data.message);
      }
    } catch (error) {
      console.error(`❌ Error creating user ${user.email}:`, error.message);
    }
  }
}

createTestUsers()
  .then(() => {
    console.log("🎉 Test users creation completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
