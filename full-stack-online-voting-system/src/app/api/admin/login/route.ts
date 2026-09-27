import { NextResponse } from "next/server";
import { adminSessionToken, checkAdminPassword, setAdminCookie } from "@/lib/election";

// Relative redirect so the browser stays on whatever host it is using.
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(request: Request) {
  const data = await request.formData();
  const password = String(data.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    return seeOther("/results?error=invalid");
  }
  // Cookie for normal browsers; ?st= fallback when cookies are blocked.
  await setAdminCookie();
  return seeOther(`/results?st=${adminSessionToken()}`);
}
