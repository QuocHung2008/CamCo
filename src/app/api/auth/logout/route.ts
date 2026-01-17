import { sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const opts = sessionCookieOptions();
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  res.headers.append(
    "set-cookie",
    `${opts.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      opts.secure ? "; Secure" : ""
    }`
  );
  return res;
}
