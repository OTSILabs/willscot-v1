import { db } from "@/lib/db";
import { results } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

function isAuthorized(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return true;
    }

    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${secret}`;
}

async function runSweep() {
    const configuredMinutes = Number(process.env.STUCK_PROCESSING_MINUTES ?? "15");
    const stuckMinutes =
        Number.isFinite(configuredMinutes) && configuredMinutes > 0
            ? configuredMinutes
            : 15;
    const cutoff = new Date(Date.now() - stuckMinutes * 60 * 1000);

    const updated = await db
        .update(results)
        .set({
            status: "failed",
            json: {
                status: "failed",
                error: `Auto-failed by sweeper after ${stuckMinutes} minutes in processing`,
                sweeper: {
                    reason: "stuck_processing_timeout",
                    timeout_minutes: stuckMinutes,
                    swept_at: new Date().toISOString(),
                },
                attributes: [],
            },
        })
        .where(and(eq(results.status, "processing"), lt(results.createdAt, cutoff)))
        .returning({ id: results.id });

    return { updatedCount: updated.length, cutoff, stuckMinutes };
}

export async function GET(req: Request) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { updatedCount, cutoff, stuckMinutes } = await runSweep();
        return NextResponse.json({
            ok: true,
            updatedCount,
            cutoff: cutoff.toISOString(),
            stuckMinutes,
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown sweep error";
        console.error("Failed to sweep stuck processing results:", errorMessage);
        return NextResponse.json(
            { error: "Failed to sweep stuck processing results", details: errorMessage },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
    return GET(req);
}

