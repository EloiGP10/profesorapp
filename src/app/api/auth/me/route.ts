import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.json({ user: { id: session.userId, email: session.email, name: session.name } });
}