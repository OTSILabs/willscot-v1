const postgres = require("postgres");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(connectionString, {
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const deletedRows = await sql`delete from results`;
    console.log("Deleted all rows from results table.");
    console.log("Command result:", deletedRows);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("Failed to clear results table:", error.message);
  process.exit(1);
});

