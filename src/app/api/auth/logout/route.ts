import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return clearAuthCookie(response);
}