import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import {
  authenticateUsernamePassword,
  createSessionJwt,
  sessionCookieOptions
} from "@/lib/auth";
import { zLogin } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = zLogin.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Dữ liệu không hợp lệ",
      details: parsed.error.flatten()
    });
  }

  const user = await authenticateUsernamePassword(parsed.data);
  if (!user) {
    return jsonError(401, {
      code: "UNAUTHORIZED",
      message: "Sai username hoặc password"
    });
  }

  const token = await createSessionJwt(user);
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  res.headers.append(
    "set-cookie",
    `${sessionCookieOptions().name}=${token}; Path=/; HttpOnly; SameSite=Lax${
      sessionCookieOptions().secure ? "; Secure" : ""
    }`
  );
  return res;
}
