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
    // Ensure unique index on user_id for upsert
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS privacy_consent_user_id_idx ON privacy_consent(user_id)`;

    // Ricava IP reale anche in deploy SSR (Netlify/Edge possono usarlo)
    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = forwardedFor.split(",")[0].trim();

    // Normalizza indirizzo: evita null inserendo stringa vuota
    const normalizedAddress = typeof address === "string" ? address : "";
    const normalizedUserId = typeof userId === "string" && userId.trim() ? userId.trim() : null;

    // Upsert by user_id: se esiste il record, aggiorna con dati più recenti
    await sql`
      INSERT INTO privacy_consent (user_id, user_agent, address, ip)
      VALUES (${normalizedUserId}, ${userAgent || null}, ${normalizedAddress}, ${ip || null})
      ON CONFLICT (user_id) DO UPDATE SET
        user_agent = EXCLUDED.user_agent,
        address = EXCLUDED.address,
        ip = EXCLUDED.ip,
        consented_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}