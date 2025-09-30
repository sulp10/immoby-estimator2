import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { neon } from "@neondatabase/serverless";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { consent, userId, userAgent, address } = body || {};
    if (!consent) {
      return NextResponse.json({ error: "Missing consent=true" }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return NextResponse.json({ error: "DATABASE_URL non configurato" }, { status: 500 });
    }

    const sql = neon(connectionString);

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS privacy_consent (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT,
        user_agent TEXT,
        address TEXT,
        ip TEXT,
        consented_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    await sql`
      INSERT INTO privacy_consent (user_id, user_agent, address, ip)
      VALUES (${userId || null}, ${userAgent || null}, ${address || null}, ${ip || null})
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}