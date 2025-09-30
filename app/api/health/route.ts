import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const googleMapsConfigured = !!process.env.GOOGLE_MAPS_API_KEY;
  const airroiConfigured = !!process.env.AIRROI_API_KEY;
  const databaseConfigured = !!process.env.DATABASE_URL;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    google_maps_configured: googleMapsConfigured,
    airroi_configured: airroiConfigured,
    database_configured: databaseConfigured,
  });
}