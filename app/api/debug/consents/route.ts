import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { neon } from "@neondatabase/serverless";

export async function GET(req: Request) {
  // Consenti solo in sviluppo per evitare esposizione dati in produzione
  const env = process.env.NODE_ENV || "development";
  if (env !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL non configurato" }, { status: 500 });
  }

  try {
    const sql = neon(connectionString);

    // Tenta di leggere, se la tabella non esiste fornisci un messaggio chiaro
    try {
      const rows = await sql`
        SELECT id, user_id, user_agent, address, ip, consented_at
        FROM privacy_consent
        ORDER BY consented_at DESC
        LIMIT 50
      `;
      return NextResponse.json({ count: rows.length, rows });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("relation") && msg.includes("does not exist")) {
        return NextResponse.json({
          error: "La tabella privacy_consent non esiste ancora",
          hint: "Esegui una POST a /api/consent con consent=true per crearla automaticamente",
        }, { status: 404 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}