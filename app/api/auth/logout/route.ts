import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  
  // Use manual header to include 'Partitioned' for CHIPS support in iframes -----
  response.headers.append(
    "Set-Cookie", 
    `auth_user=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );

  return response;
}

