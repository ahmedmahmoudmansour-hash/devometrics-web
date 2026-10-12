import { randomUUID } from "node:crypto";

// Minimal REST/Storage client for the live suite. Everything runs as a real
// signed-in user with the public anon key, so Row Level Security is exactly
// what a customer's browser would face. There is deliberately no service key.

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const liveConfigured = Boolean(
  URL_BASE && ANON_KEY && process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD && process.env.TEST_MEMBER_EMAIL && process.env.TEST_MEMBER_PASSWORD
);

export type Res<T = unknown> = { status: number; body: T };

export type Session = {
  userId: string;
  email: string;
  token: string;
  get: <T = unknown[]>(path: string) => Promise<Res<T>>;
  post: <T = unknown[]>(path: string, body: unknown) => Promise<Res<T>>;
  patch: <T = unknown[]>(path: string, body: unknown) => Promise<Res<T>>;
  del: <T = unknown[]>(path: string) => Promise<Res<T>>;
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<Res<T>>;
  upload: (bucket: string, path: string, body: Buffer | string, contentType: string) => Promise<number>;
  download: (bucket: string, path: string) => Promise<number>;
  list: (bucket: string, prefix: string) => Promise<number>;
  removeObjects: (bucket: string, paths: string[]) => Promise<void>;
};

async function json(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function makeSession(userId: string, email: string, token: string | null): Session {
  const auth = { apikey: ANON_KEY, Authorization: `Bearer ${token ?? ANON_KEY}` };
  const rest = async (method: string, path: string, body?: unknown, prefer = "return=representation") => {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      method,
      headers: { ...auth, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Prefer: prefer },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await json(res) };
  };
  return {
    userId,
    email,
    token: token ?? ANON_KEY,
    get: (p) => rest("GET", p) as never,
    post: (p, b) => rest("POST", p, b) as never,
    patch: (p, b) => rest("PATCH", p, b) as never,
    del: (p) => rest("DELETE", p) as never,
    rpc: async (fn, args = {}) => {
      const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return { status: res.status, body: (await json(res)) as never };
    },
    upload: async (bucket, path, body, contentType) =>
      (await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": contentType, "x-upsert": "true" },
        body: typeof body === "string" ? body : new Uint8Array(body),
      })).status,
    download: async (bucket, path) => (await fetch(`${URL_BASE}/storage/v1/object/authenticated/${bucket}/${path}`, { headers: auth })).status,
    list: async (bucket, prefix) => {
      const res = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 100 }),
      });
      const b = await json(res);
      return Array.isArray(b) ? b.length : -1;
    },
    removeObjects: async (bucket, paths) => {
      if (paths.length === 0) return;
      await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
    },
  };
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const b = (await json(res)) as { access_token?: string; user?: { id: string } } | null;
  if (!b?.access_token || !b.user) throw new Error(`Test login failed for ${email} (HTTP ${res.status})`);
  return makeSession(b.user.id, email, b.access_token);
}

export const anon = (): Session => makeSession("", "", null);

export async function loginAdmin() {
  return login(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
}
export async function loginMember() {
  return login(process.env.TEST_MEMBER_EMAIL!, process.env.TEST_MEMBER_PASSWORD!);
}

export const uuid = () => randomUUID();
export const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The organization the signed-in user administers. */
export async function adminOrgId(s: Session): Promise<string> {
  const r = await s.get<{ organization_id: string }[]>(`organization_members?user_id=eq.${s.userId}&role=eq.admin&select=organization_id`);
  const id = r.body?.[0]?.organization_id;
  if (!id) throw new Error("TEST_ADMIN_* account is not an admin of any organization");
  return id;
}

/** A throwaway company owned by `owner`, removed again by `cleanup`. */
export async function createThrowawayOrg(owner: Session, label: string) {
  const r = await owner.post<{ id: string }[]>("organizations", { name: `TEST ${label} ${stamp()}`, slug: `test-${label}-${stamp()}`, created_by: owner.userId });
  const id = r.body?.[0]?.id;
  if (!id) throw new Error(`could not create a throwaway organization (HTTP ${r.status})`);
  await owner.post("organization_members", { organization_id: id, user_id: owner.userId, role: "admin" });
  return { id, cleanup: async () => void (await owner.del(`organizations?id=eq.${id}`)) };
}
