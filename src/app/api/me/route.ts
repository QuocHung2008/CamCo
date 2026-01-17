import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { getUserFromNextRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromNextRequest(req);
  if (!user) {
    return jsonError(401, { code: "UNAUTHORIZED", message: "Chưa đăng nhập" });
  }
  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
