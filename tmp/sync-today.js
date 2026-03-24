
const { db } = require('./lib/db');
const { results, resultAttributes } = require('./lib/db/schema');
const { eq, and, sql, gte } = require('drizzle-orm');

async function sync() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayResults = await db.select().from(results)
      .where(gte(results.createdAt, today));

    console.log(`Found ${todayResults.length} traces created today.`);

    for (const res of todayResults) {
      console.log(`Trace ${res.id} - Status: ${res.status}`);
      
      const [existingAttr] = await db.select({ count: sql`count(*)` })
        .from(resultAttributes)
        .where(eq(resultAttributes.resultId, res.id));

      if (Number(existingAttr.count) === 0 && res.status === 'completed' && res.json && res.json.attributes) {
        console.log(`Syncing attributes for ${res.id}...`);
        const attributes = res.json.attributes;
        if (Array.isArray(attributes) && attributes.length > 0) {
          await db.insert(resultAttributes).values(
            attributes.map((attr) => ({
              resultId: res.id,
              name: attr.attribute || attr.label || attr.name || "Unknown",
              source: attr.source || "interior",
              value: String(attr.value || ""),
              status: (attr.status === 'correct' || attr.feedback === 'Correct' || attr.isCorrect === true) ? "correct" : 
                      (attr.status === 'wrong' || attr.status === 'incorrect' || attr.feedback === 'Incorrect' || attr.isCorrect === false) ? "incorrect" : "unmarked",
              confidence: attr.confidence || null,
              timestamp: attr.timestamp || null,
            }))
          );
          console.log(`Synced ${attributes.length} attributes.`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

sync();
