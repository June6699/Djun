import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import { cookies } from "next/headers";
import { ensureStorage, sessionSecretPath } from "./paths";

const COOKIE_NAME = "djun_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64url(input: string) {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function createPasswordHash(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  if (expected.length !== derived.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expected);
}

function getSecret() {
  ensureStorage();

  if (process.env.DJUN_SESSION_SECRET) {
    return process.env.DJUN_SESSION_SECRET;
  }

  if (!fs.existsSync(sessionSecretPath)) {
    fs.writeFileSync(sessionSecretPath, crypto.randomBytes(48).toString("hex"), "utf8");
  }

  return fs.readFileSync(sessionSecretPath, "utf8").trim();
}

function signPayload(payload: string) {
  return base64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
}

export function createSessionToken(userId: string) {
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + SESSION_MAX_AGE * 1000
    })
  );
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64url(payload)) as { sub?: string; exp?: number };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

export async function readSessionUserId() {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export function writeSessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: false,
      maxAge: SESSION_MAX_AGE,
      path: "/"
    }
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: false,
      maxAge: 0,
      path: "/"
    }
  };
}

export { COOKIE_NAME };
