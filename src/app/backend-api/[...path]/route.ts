import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedPrefixes = [
  "health",
  "api/auth",
  "api/profile",
  "api/diary",
  "api/planned-meals",
  "api/foods",
  "api/favorites",
  "api/community",
  "api/ai",
];

function backendOrigin() {
  const raw = process.env.GABIA_BACKEND_ORIGIN?.trim();
  if (!raw) throw new Error("GABIA_BACKEND_ORIGIN is not configured");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid backend protocol");
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.join("/");
  if (!allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return Response.json({ error: "proxy_path_not_allowed" }, { status: 404 });
  }

  try {
    const target = new URL(pathname, backendOrigin());
    target.search = request.nextUrl.search;
    const headers = new Headers();
    for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const cookieHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = cookieHeaders.getSetCookie?.() ?? (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")!] : []);
    for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Gabia backend proxy failed", error);
    return Response.json({ error: "backend_unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
