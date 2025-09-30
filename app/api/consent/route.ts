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
    // Ricava IP reale anche in deploy SSR (Netlify/Edge possono usarlo)
    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = forwardedFor.split(",")[0].trim();

    // Normalizza indirizzo e user_id
    const normalizedAddress = typeof address === "string" ? address : "";
    const normalizedUserId = typeof userId === "string" && userId.trim() ? userId.trim() : null;

    // Upsert manuale: evita dipendenza da indice unico per ON CONFLICT
    if (normalizedUserId) {
      const existing = await sql<{ id: number }[]>`
        SELECT id FROM privacy_consent WHERE user_id = ${normalizedUserId} LIMIT 1
      `;
      if (existing.length > 0) {
        await sql`
          UPDATE privacy_consent
          SET user_agent = ${userAgent || null},
              address = ${normalizedAddress},
              ip = ${ip || null},
              consented_at = NOW()
          WHERE user_id = ${normalizedUserId}
        `;
      } else {
        await sql`
          INSERT INTO privacy_consent (user_id, user_agent, address, ip)
          VALUES (${normalizedUserId}, ${userAgent || null}, ${normalizedAddress}, ${ip || null})
        `;
      }
    } else {
      // Nessun user_id: inserisci un record con user_id NULL
      await sql`
        INSERT INTO privacy_consent (user_id, user_agent, address, ip)
        VALUES (NULL, ${userAgent || null}, ${normalizedAddress}, ${ip || null})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Fornisci errore dettagliato
    const msg = err?.message || String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}