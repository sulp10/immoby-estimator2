import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const address = u.searchParams.get("address");
  if (!address) return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: 400,
    error: "Bad Request",
    message: "Parametro 'address' mancante.",
    path: "/api/geocode",
  }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({
    timestamp: new Date().toISOString(),
    status: 500,
    error: "Internal Server Error",
    message: "Google Maps API key non configurata.",
    path: "/api/geocode",
  }, { status: 500 });

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;

  const fetchWithTimeout = async (timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  try {
    // Primo tentativo con timeout
    let res: Response;
    try {
      res = await fetchWithTimeout(8000);
    } catch (e1: any) {
      // Piccolo backoff e secondo tentativo
      await new Promise((r) => setTimeout(r, 500));
      res = await fetchWithTimeout(8000);
    }

    const data = await res.json();
    if (data.status !== "OK") {
      const msg = data.error_message || data.status || "Errore geocodifica";
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        status: 502,
        error: "Bad Gateway",
        message: msg,
        path: "/api/geocode",
      }, { status: 502 });
    }
    // Riduciamo i campi per privacy/peso, ma includiamo i dettagli necessari per l'interfaccia
    const results = (data.results || []).map((r: any) => ({
      formatted_address: r.formatted_address,
      place_id: r.place_id,
      geometry: { location: r.geometry?.location },
      address_components: r.address_components || [],
      types: r.types || [],
    }));
    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 502,
      error: "Bad Gateway",
      message: `Errore di rete verso Google: ${err?.message || err}`,
      path: "/api/geocode",
      url,
      hint: "Verifica connettività uscente, eventuale proxy aziendale (HTTP(S)_PROXY) o blocchi firewall verso maps.googleapis.com"
    }, { status: 502 });
  }
}
