export type InstagramProfile = {
  id: string;
  username: string;
};

export type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export type InstagramMedia = {
  id: string;
  media_type: InstagramMediaType;
  media_url: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  caption?: string;
};

type GraphResponse<T> = { data: T };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeToken(token: string) {
  return token.trim();
}

function ensureOkToken(token: string) {
  const t = normalizeToken(token);
  if (!isNonEmptyString(t)) throw new Error("Instagram access token is empty");
  return t;
}

function makeUrl(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && json !== null && "error" in json
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((json as any).error?.message as string | undefined)
        : undefined) ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/**
 * Frontend-only Instagram Basic Display API helper.
 * Requires user-provided access_token (no OAuth flow here).
 *
 * Docs (Basic Display): https://developers.facebook.com/docs/instagram-basic-display-api/
 */
export async function fetchInstagramProfile(args: { accessToken: string }): Promise<InstagramProfile> {
  const token = ensureOkToken(args.accessToken);
  const url = makeUrl("https://graph.instagram.com/me", {
    fields: "id,username",
    access_token: token,
  });
  return await fetchJson<InstagramProfile>(url);
}

export async function fetchInstagramMedia(args: {
  accessToken: string;
  limit?: number;
}): Promise<InstagramMedia[]> {
  const token = ensureOkToken(args.accessToken);
  const url = makeUrl("https://graph.instagram.com/me/media", {
    fields: "id,media_type,media_url,thumbnail_url,permalink,timestamp,caption",
    limit: args.limit ?? 60,
    access_token: token,
  });
  const res = await fetchJson<GraphResponse<InstagramMedia[]>>(url);
  return Array.isArray(res.data) ? res.data : [];
}

