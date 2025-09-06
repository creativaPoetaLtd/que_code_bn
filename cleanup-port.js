// Simple utility script to clean up port 3000
const { execSync } = require("child_process");

try {
  console.log("🧹 Cleaning up port 3000...");
  execSync("npx kill-port 3000");
  console.log("✅ Port 3000 freed successfully");
} catch (error) {
  // Ignore if the port is not in use
  console.log("ℹ️ Port 3000 was not in use");
}
