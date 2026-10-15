// MongoDB initialization script
// This script runs only on first database creation
// User credentials should be set via environment variables in docker-compose.yml

db = db.getSiblingDB("neuropattern");

// Create application user with least-privilege access
// This user has readWrite access ONLY to the neuropattern database
// In production, set MONGO_APP_USER and MONGO_APP_PASSWORD in docker-compose.yml
if (
  typeof MONGO_APP_USER !== "undefined" &&
  typeof MONGO_APP_PASSWORD !== "undefined" &&
  MONGO_APP_USER &&
  MONGO_APP_PASSWORD
) {
  try {
    db.createUser({
      user: MONGO_APP_USER,
      pwd: MONGO_APP_PASSWORD,
      roles: [{ role: "readWrite", db: "neuropattern" }],
    });
    print("Application user created successfully: " + MONGO_APP_USER);
  } catch (e) {
    // User may already exist if volume is reused
    if (e.code === 51003) {
      print("Application user already exists: " + MONGO_APP_USER);
    } else {
      print("Error creating application user: " + e);
    }
  }
} else {
  print(
    "WARNING: MONGO_APP_USER or MONGO_APP_PASSWORD not set. Application user not created.",
  );
  print(
    "The application will use root credentials (not recommended for production).",
  );
}
