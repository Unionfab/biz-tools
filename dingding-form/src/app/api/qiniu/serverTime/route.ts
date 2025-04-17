// dingding-form/src/app/api/server-time/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const serverTime = new Date();

  return NextResponse.json({
    time: serverTime.toISOString(),
    timestamp: serverTime.getTime(),
  });
}
