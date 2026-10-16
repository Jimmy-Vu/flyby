import type { IncomingMessage, ServerResponse } from "node:http";

export interface ProxyEnv {
  OPENSKY_CLIENT_ID?: string;
  OPENSKY_CLIENT_SECRET?: string;
}

const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";
const ALLOWED_PARAMS = ["lamin", "lamax", "lomin", "lomax", "extended"];

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

export function createApiHandler(env: ProxyEnv) {
  let token = "";
  let tokenExpiresAt = 0;

  async function getToken() {
    if (token && Date.now() < tokenExpiresAt) return token;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.OPENSKY_CLIENT_ID ?? "",
        client_secret: env.OPENSKY_CLIENT_SECRET ?? "",
      }),
    });
    if (!res.ok) throw new Error(`OpenSky token request failed (HTTP ${res.status})`);

    const json = (await res.json()) as { access_token: string; expires_in?: number };
    token = json.access_token;
    tokenExpiresAt = Date.now() + ((json.expires_in ?? 1800) - 60) * 1000;
    return token;
  }

  return async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();

    if (req.method !== "GET" || url.pathname !== "/api/opensky/states") {
      return send(res, 404, { error: "Not found" });
    }
    if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) {
      return send(res, 503, { error: "OpenSky credentials not configured" });
    }

    const params = new URLSearchParams();
    for (const name of ALLOWED_PARAMS) {
      const value = url.searchParams.get(name);
      if (value === null) continue;
      if (!Number.isFinite(Number(value))) {
        return send(res, 400, { error: `Invalid parameter: ${name}` });
      }
      params.set(name, value);
    }

    try {
      const upstream = await fetch(`${STATES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (upstream.status === 401) token = "";
      if (!upstream.ok) {
        return send(res, upstream.status, { error: `OpenSky returned HTTP ${upstream.status}` });
      }
      send(res, 200, await upstream.text());
    } catch (error) {
      console.error("[api-proxy]", error instanceof Error ? error.message : error);
      send(res, 502, { error: "Upstream request failed" });
    }
  };
}
