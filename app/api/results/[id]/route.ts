import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [result] = await db
      .select()
      .from(results)
      .where(eq(results.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching result detail:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch result detail" },
      { status: 500 },
    );
  }
}
