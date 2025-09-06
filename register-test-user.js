const https = require("http");

const userData = {
  firstName: "Yvette",
  lastName: "Izanyibuka",
  email: "yvetteizanyibuka@huzalabs.com",
  password: "Test@123",
};

const postData = JSON.stringify(userData);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/auth/register",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

console.log("🔄 Registering user:", userData.email);

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("📊 Status Code:", res.statusCode);
    console.log("📋 Response:", data);

    try {
      const response = JSON.parse(data);
      if (res.statusCode === 201) {
        console.log("✅ User registered successfully!");
        console.log("📧 User ID:", response.data?.user?.id);
      } else {
        console.log("❌ Registration failed:", response.message);
      }
    } catch (error) {
      console.log("❌ Error parsing response:", error.message);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request error:", error.message);
});

req.write(postData);
req.end();
