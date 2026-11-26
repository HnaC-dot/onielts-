import { NextResponse } from "next/server";
import { getBandConversionTables } from "@/lib/db";

export async function GET() {
  const rows = await getBandConversionTables();
  return NextResponse.json({ rows });
}
