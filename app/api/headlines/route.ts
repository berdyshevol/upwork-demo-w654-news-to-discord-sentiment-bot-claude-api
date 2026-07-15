import { NextResponse } from "next/server";
import { headlines } from "@/lib/seed";

export async function GET() {
  return NextResponse.json({ headlines });
}
