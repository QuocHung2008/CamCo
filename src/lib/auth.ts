import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";

export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export type RequestUser = {
  id: string;
  username: string;
  role: Role;
};

const COOKIE_NAME = "camco_session";

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) throw new Error("Missing AUTH_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export function canEdit(user: RequestUser) {
  return user.role === "ADMIN" || user.role === "EDITOR";
}

export function canExport(user: RequestUser) {
  return user.role === "ADMIN" || user.role === "EDITOR";
}

export function canDelete(user: RequestUser) {
  return user.role === "ADMIN" || user.role === "EDITOR";
}

export async function createSessionJwt(user: RequestUser) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionJwt(token: string): Promise<RequestUser> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  const sub = payload.sub;
  if (typeof sub !== "string") throw new Error("Invalid token subject");
  const username = payload.username;
  const role = payload.role;
  if (typeof username !== "string") throw new Error("Invalid token username");
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "VIEWER") {
    throw new Error("Invalid token role");
  }
  return { id: sub, username, role };
}

export function getSessionTokenFromRequest(req: NextRequest) {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export async function getUserFromNextRequest(
  req: NextRequest
): Promise<RequestUser | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  try {
    return await verifySessionJwt(token);
  } catch {
    return null;
  }
}

export async function getRequestUser(): Promise<RequestUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionJwt(token);
  } catch {
    return null;
  }
}

export async function authenticateUsernamePassword(input: {
  username: string;
  password: string;
}): Promise<RequestUser | null> {
  const user = await prisma.user.findUnique({
    where: { username: input.username }
  });
  if (!user) return null;
  const ok = await compare(input.password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role as Role
  };
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/"
  };
}
