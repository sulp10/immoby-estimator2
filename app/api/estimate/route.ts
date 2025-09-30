import { NextResponse } from "next/server";

const AIRROI_URL = "https://api.airroi.com/calculator/estimate";

function clampNum(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const p = u.searchParams;

  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const bedrooms = Number(p.get("bedrooms"));
  const baths = Number(p.get("baths"));
  const guests = Number(p.get("guests"));
  let currency = (p.get("currency") || "native").toLowerCase();

  // Validazioni
  if (!Number.isFinite(lat) || lat < -90 || lat > 90)
    return NextResponse.json({ error: "La latitudine deve essere compresa tra -90 e 90." }, { status: 400 });
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    return NextResponse.json({ error: "La longitudine deve essere compresa tra -180 e 180." }, { status: 400 });
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 20)
    return NextResponse.json({ error: "Il numero di camere deve essere tra 0 e 20." }, { status: 400 });
  if (!Number.isFinite(baths) || baths < 0.5 || baths > 20)
    return NextResponse.json({ error: "Il numero di bagni deve essere compreso tra 0.5 e 20." }, { status: 400 });
  if (!Number.isInteger(guests) || guests < 1 || guests > 30)
    return NextResponse.json({ error: "Il numero massimo di ospiti deve essere tra 1 e 30." }, { status: 400 });
  if (currency !== "usd" && currency !== "native") currency = "native";

  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    bedrooms: String(bedrooms),
    baths: String(baths),
    guests: String(guests),
    currency,
  });

  const apiKey = process.env.AIRROI_API_KEY;
  if (!apiKey) return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: 500,
    error: "Internal Server Error",
    message: "AIRROI API key non configurata.",
    path: "/api/estimate"
  }, { status: 500 });

  try {
    const res = await fetch(`${AIRROI_URL}?${qs.toString()}`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `${res.status} ${res.statusText}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: `Errore di rete verso AIRROI: ${err?.message || err}` }, { status: 502 });
  }
}
