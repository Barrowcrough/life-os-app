/**
 * Life OS Broker API (Cloudflare Workers)
 *
 * Endpoints:
 * - GET  /v1/health
 * - POST /v1/session
 * - POST /v1/gist/create
 * - POST /v1/gist/push
 * - POST /v1/gist/pull
 *
 * Required env:
 * - GITHUB_PAT
 * - BROKER_PASSPHRASE
 * - SESSION_SIGNING_SECRET
 *
 * Optional env:
 * - SESSION_TTL_SEC (default: 1800)
 * - GIST_FILE_NAME (default: life-os-data.json)
 * - ALLOWED_ORIGINS (comma separated, default: *)
 */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === "GET" && path === "/v1/health") {
        return json({ ok: true, service: "life-os-broker" }, 200, corsHeaders);
      }

      if (request.method === "POST" && path === "/v1/session") {
        return handleCreateSession(request, env, corsHeaders);
      }

      if (request.method === "POST" && path === "/v1/gist/create") {
        await requireAuth(request, env);
        return handleCreateGist(request, env, corsHeaders);
      }

      if (request.method === "POST" && path === "/v1/gist/push") {
        await requireAuth(request, env);
        return handlePushGist(request, env, corsHeaders);
      }

      if (request.method === "POST" && path === "/v1/gist/pull") {
        await requireAuth(request, env);
        return handlePullGist(request, env, corsHeaders);
      }

      return json({ message: "Not Found" }, 404, corsHeaders);
    } catch (err) {
      const status = Number.isInteger(err.status) ? err.status : 500;
      const message = err && err.message ? err.message : "Internal Server Error";
      return json({ message }, status, corsHeaders);
    }
  }
};

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let allowOrigin = "*";
  if (!allowedOrigins.includes("*")) {
    if (origin && allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else if (allowedOrigins.length > 0) {
      allowOrigin = allowedOrigins[0];
    } else {
      allowOrigin = "";
    }
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders
    }
  });
}

async function parseJsonBody(request) {
  let data = null;
  try {
    data = await request.json();
  } catch (_err) {
    throw httpError(400, "JSONボディが不正です。");
  }
  return data && typeof data === "object" ? data : {};
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function getRequiredEnv(env, key) {
  const value = env[key];
  if (!value) throw httpError(500, `Missing env: ${key}`);
  return value;
}

function getTtlSeconds(env) {
  const raw = Number(env.SESSION_TTL_SEC || 1800);
  if (!Number.isFinite(raw)) return 1800;
  return Math.max(60, Math.min(7200, Math.floor(raw)));
}

async function handleCreateSession(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
  const expected = getRequiredEnv(env, "BROKER_PASSPHRASE");
  if (!passphrase || passphrase !== expected) {
    throw httpError(401, "認証に失敗しました。");
  }

  const ttlSec = getTtlSeconds(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + ttlSec;
  const payload = {
    sub: "life-os-client",
    iat: nowSec,
    exp,
    scope: "gist:sync"
  };
  const token = await signJwt(payload, getRequiredEnv(env, "SESSION_SIGNING_SECRET"));
  return json(
    {
      accessToken: token,
      expiresInSec: ttlSec,
      expiresAt: new Date(exp * 1000).toISOString()
    },
    200,
    corsHeaders
  );
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Authorizationヘッダーが必要です。");
  const token = match[1];
  const payload = await verifyJwt(token, getRequiredEnv(env, "SESSION_SIGNING_SECRET"));
  if (!payload || payload.scope !== "gist:sync") {
    throw httpError(403, "トークン権限が不足しています。");
  }
  return payload;
}

function getGistFileName(env) {
  return env.GIST_FILE_NAME || "life-os-data.json";
}

function getDefaultPayload() {
  return {
    schemaVersion: 1,
    app: "life-os-daily-review",
    updatedAt: new Date().toISOString(),
    updatedBy: "broker-api",
    entries: []
  };
}

async function handleCreateGist(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  const description = typeof body.description === "string" && body.description.trim()
    ? body.description.trim()
    : "人生OS 日次レビュー データ";
  const payload = body.payload && typeof body.payload === "object" ? body.payload : getDefaultPayload();
  const fileName = getGistFileName(env);

  const gist = await callGithub(env, "/gists", {
    method: "POST",
    body: JSON.stringify({
      description,
      public: false,
      files: {
        [fileName]: {
          content: JSON.stringify(payload, null, 2)
        }
      }
    })
  });

  return json(
    {
      gistId: gist.id,
      htmlUrl: gist.html_url
    },
    200,
    corsHeaders
  );
}

async function handlePushGist(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  const gistId = typeof body.gistId === "string" ? body.gistId.trim() : "";
  if (!gistId) throw httpError(400, "gistIdが必要です。");
  const payload = body.payload && typeof body.payload === "object" ? body.payload : getDefaultPayload();
  const fileName = getGistFileName(env);

  await callGithub(env, `/gists/${gistId}`, {
    method: "PATCH",
    body: JSON.stringify({
      description: "人生OS 日次レビュー データ",
      files: {
        [fileName]: {
          content: JSON.stringify(payload, null, 2)
        }
      }
    })
  });

  return json({ ok: true, gistId }, 200, corsHeaders);
}

async function handlePullGist(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  const gistId = typeof body.gistId === "string" ? body.gistId.trim() : "";
  if (!gistId) throw httpError(400, "gistIdが必要です。");

  const gist = await callGithub(env, `/gists/${gistId}`);
  const files = gist.files || {};
  const targetName = getGistFileName(env);
  let file = files[targetName];
  if (!file) {
    const values = Object.values(files);
    file = values.find((f) => f && typeof f.filename === "string" && f.filename.endsWith(".json")) || null;
  }
  if (!file) throw httpError(404, "GistにJSONファイルが見つかりません。");

  const contentText = await resolveGistFileContent(file, env);
  let payload = null;
  try {
    payload = JSON.parse(contentText);
  } catch (_err) {
    throw httpError(500, "GistデータのJSON解析に失敗しました。");
  }

  return json(
    {
      gistId,
      fileName: file.filename,
      payload
    },
    200,
    corsHeaders
  );
}

async function callGithub(env, path, init = {}) {
  const token = getRequiredEnv(env, "GITHUB_PAT");
  const response = await fetch(`https://api.github.com${path}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    body: init.body
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_err) {
    data = null;
  }

  if (!response.ok) {
    const message = data && data.message ? data.message : `GitHub API error: ${response.status}`;
    throw httpError(response.status, message);
  }
  return data;
}

async function resolveGistFileContent(file, env) {
  if (typeof file.content === "string" && !file.truncated) return file.content;
  if (!file.raw_url) throw httpError(404, "Gist raw_urlが見つかりません。");

  const token = getRequiredEnv(env, "GITHUB_PAT");
  const response = await fetch(file.raw_url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) throw httpError(response.status, "Gist rawファイル取得に失敗しました。");
  return response.text();
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(uint8Array) {
  let bin = "";
  for (const byte of uint8Array) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function encodeJsonBase64Url(value) {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJsonBase64Url(value) {
  const bytes = fromBase64Url(value);
  return JSON.parse(decoder.decode(bytes));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeJsonBase64Url(header);
  const encodedPayload = encodeJsonBase64Url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  const encodedSig = toBase64Url(new Uint8Array(signature));
  return `${signingInput}.${encodedSig}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw httpError(401, "トークン形式が不正です。");
  const [encodedHeader, encodedPayload, encodedSig] = parts;

  let header = null;
  let payload = null;
  try {
    header = decodeJsonBase64Url(encodedHeader);
    payload = decodeJsonBase64Url(encodedPayload);
  } catch (_err) {
    throw httpError(401, "トークンのデコードに失敗しました。");
  }
  if (!header || header.alg !== "HS256") {
    throw httpError(401, "トークンアルゴリズムが不正です。");
  }

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(encodedSig),
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) throw httpError(401, "トークン署名が不正です。");

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || nowSec >= payload.exp) {
    throw httpError(401, "トークンの有効期限が切れています。");
  }

  return payload;
}
