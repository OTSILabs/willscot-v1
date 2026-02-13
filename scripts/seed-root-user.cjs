/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
const postgres = require("postgres");
const { createHash } = require("crypto");

async function main() {
  const sql = postgres(process.env.DATABASE_URL, {
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });

  const passwordHash = createHash("md5")
    .update(process.env.ROOT_USER_PASSWORD || "root123")
    .digest("hex");

  await sql`
    insert into users (name, email, password_hash, role)
    values (${"Admin related"}, ${"root@willscot.local"}, ${passwordHash}, ${"power_user"})
    on conflict (email) do update
    set
      name = excluded.name,
      password_hash = excluded.password_hash,
      role = excluded.role
  `;

  await sql.end();
  console.log("Initial user upserted: root@willscot.local");
}

main().catch((error) => {
  console.error("Failed to seed initial user:", error);
  process.exit(1);
});

