import { db } from "./lib/db";
import { users } from "./lib/db/schema";

async function main() {
  const allUsers = await db.select().from(users).limit(10);
  console.log(JSON.stringify(allUsers, null, 2));
}

main().catch(console.error);
