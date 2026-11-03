// Staged one-way migration runner: Lovable Cloud -> Firebase (existing project nyra-music-566bf).
// Read-only on the source except writes into the target Firebase project.
// All actions require an authenticated user JWT with the `admin` role in user_roles.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FIREBASE_PROJECT_ID = 'nyra-music-566bf';
const STORAGE_BUCKET_CANDIDATES = [`${FIREBASE_PROJECT_ID}.appspot.com`, `${FIREBASE_PROJECT_ID}.firebasestorage.app`];

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id?: string;
};

let cachedToken: { token: string; exp: number } | null = null;

function base64UrlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlFromStr(str: string): string {
  return base64UrlFromBytes(new TextEncoder().encode(str));
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getGoogleAccessToken(): Promise<string> {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON secret is not configured');
  const sa: ServiceAccount = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = base64UrlFromStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlFromStr(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/devstorage.full_control',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64UrlFromBytes(new Uint8Array(sig))}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Service role is not available in this runtime');
  return {
    rest: async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`Source REST ${path} failed [${res.status}]: ${(await res.text()).slice(0, 400)}`);
      return res;
    },
    storage: async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${url}/storage/v1/${path}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      return res;
    },
  };
}

async function requireAdmin(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return 'unauthorized';
  let uid = 'unknown';
  let role = 'anon';
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    uid = payload.sub ?? 'unknown';
    role = payload.role ?? 'anon';
    if (payload.exp && payload.exp * 1000 < Date.now()) return 'expired';
  } catch {
    return 'invalid';
  }
  if (role !== 'authenticated') return 'not_authenticated';
  const db = adminClient();
  const res = await db.rest(`user_roles?select=role&user_id=eq.${uid}`);
  const roles = await res.json() as { role: string }[];
  if (!roles.some((r) => r.role === 'admin')) return 'forbidden';
  return 'ok';
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ---------- Firestore value encoding ----------

const ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

function toFirestoreValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) && Math.abs(v) < 2 ** 53 ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') {
    return ISO_RE.test(v) && !isNaN(Date.parse(v)) ? { timestampValue: v.replace(' ', 'T') } : { stringValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function rowToFields(row: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) fields[k] = toFirestoreValue(v);
  return fields;
}

async function firestoreBatchWrite(writes: { collection: string; docId: string; fields: Record<string, unknown> }[]) {
  const token = await getGoogleAccessToken();
  const body = {
    writes: writes.map((w) => ({
      update: {
        name: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${w.collection}/${w.docId}`,
        fields: w.fields,
      },
    })),
  };
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:batchWrite`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Firestore batchWrite failed [${res.status}]: ${(await res.text()).slice(0, 600)}`);
  const json = await res.json() as { writeResults?: { status?: string }[] };
  return json.writeResults ?? [];
}

// ---------- Actions ----------

async function actionValidate() {
  let token: string | null = null;
  try {
    token = await getGoogleAccessToken();
  } catch (e) {
    // Report only boolean diagnostics — never any key material or derived values.
    const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    const diag: Record<string, unknown> = { tokenExchangeOk: false, error: String(e).slice(0, 200) };
    if (!raw) {
      diag.secretPresent = false;
    } else {
      diag.secretPresent = true;
      try {
        const sa = JSON.parse(raw) as Partial<ServiceAccount>;
        diag.jsonParses = true;
        diag.hasClientEmail = typeof sa.client_email === 'string' && sa.client_email.length > 0;
        diag.hasTokenUri = typeof sa.token_uri === 'string' && sa.token_uri.length > 0;
        diag.hasPrivateKeyField = typeof sa.private_key === 'string';
        if (typeof sa.private_key === 'string') {
          diag.pkHasBeginMarker = sa.private_key.includes('-----BEGIN PRIVATE KEY-----');
          diag.pkHasEndMarker = sa.private_key.includes('-----END PRIVATE KEY-----');
          let importOk = false;
          try {
            await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
            importOk = true;
          } catch { importOk = false; }
          diag.pkImportsAsPkcs8 = importOk;
        }
      } catch {
        diag.jsonParses = false;
      }
    }
    return json({ ok: false, stage: 'token-exchange', diag }, 200);
  }
  const report: Record<string, unknown> = {};

  // Service account identity
  const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!) as ServiceAccount;
  report.serviceAccount = {
    client_email: sa.client_email,
    project_id: sa.project_id ?? null,
  };

  // Auth (Identity Toolkit): read 1 existing account
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:batchGet?maxResults=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  report.auth = authRes.ok
    ? { ok: true, status: authRes.status, existingUsers: ((await authRes.json()) as { users?: unknown[] }).users?.length ?? 0 }
    : { ok: false, status: authRes.status, detail: (await authRes.text()).slice(0, 300) };

  // Firestore: the default database must answer a collection-level read.
  // (A bare /documents path is not a valid REST target and always 404s with HTML.)
  const fsRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/__validate_probe__`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  report.firestore = fsRes.ok
    ? { ok: true, status: fsRes.status }
    : { ok: false, status: fsRes.status, detail: (await fsRes.text()).slice(0, 300) };

  // Storage: find which bucket name exists
  const buckets: Record<string, unknown> = {};
  for (const b of STORAGE_BUCKET_CANDIDATES) {
    const sRes = await fetch(`https://firebasestorage.googleapis.com/v0/b/${b}/o?maxResults=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    buckets[b] = sRes.ok ? 'exists' : `status ${sRes.status}`;
  }
  report.storage = buckets;
  return json(report);
}

type AuthUser = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
  banned_until: string | null;
  created_at: string;
};

function toImportUser(u: AuthUser) {
  const acct: Record<string, unknown> = {
    localId: u.id,
    email: u.email,
    emailVerified: Boolean(u.email_confirmed_at),
    createdAt: String(new Date(u.created_at).getTime()),
  };
  const meta = (u.raw_user_meta_data ?? {}) as Record<string, unknown>;
  if (typeof meta.name === 'string' && meta.name) acct.displayName = meta.name;
  if (typeof meta.avatar_url === 'string' && meta.avatar_url) acct.photoUrl = meta.avatar_url;
  if (u.banned_until && new Date(u.banned_until).getTime() > Date.now()) acct.disabled = true;
  if (u.encrypted_password) acct.passwordHash = base64UrlFromStr(u.encrypted_password);
  return acct;
}

async function importUserChunk(users: AuthUser[]) {
  const token = await getGoogleAccessToken();
  const body = {
    users: users.map(toImportUser),
    hashAlgorithm: 'BCRYPT',
    allowOverwrite: true,
  };
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:batchCreate`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 800) };
  const j = JSON.parse(text) as { error?: { errors?: { index: number; message: string }[] } };
  const errs = (j.error?.errors ?? []).map((e) => ({ email: users[e.index]?.email, message: e.message }));
  return { ok: true, imported: users.length - errs.length, errors: errs };
}

async function readUsersViaPostgrest(limit: number, offset: number): Promise<AuthUser[]> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/rest/v1/users?select=id,email,encrypted_password,email_confirmed_at,raw_user_meta_data,banned_until,created_at&order=created_at.asc&limit=${limit}&offset=${offset}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Profile': 'auth', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`auth.users read failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function actionMigrateUsers(offset = 0, chunk = 60) {
  const users = await readUsersViaPostgrest(chunk, offset);
  if (users.length === 0) return json({ done: true, offset, importedThisRun: 0 });
  const result = await importUserChunk(users);
  return json({ done: users.length < chunk, offset, fetched: users.length, result, nextOffset: offset + users.length });
}

async function listPublicTables(): Promise<string[]> {
  const db = adminClient();
  // Use a generic RPC-free approach: information_schema is not exposed via REST, so
  // query known tables via a Supabase SQL read is unavailable; instead the caller
  // (supabase--read_query outside this function) already knows the table list.
  // Fallback: try to detect via PostgREST OpenAPI root.
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/`, {
    headers: { apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
  });
  if (!res.ok) throw new Error(`OpenAPI discovery failed [${res.status}]`);
  const spec = await res.json() as { definitions?: Record<string, unknown> };
  return Object.keys(spec.definitions ?? {});
}

async function actionMigrateTable(tableName: string, offset = 0, chunk = 200) {
  const db = adminClient();
  const res = await db.rest(`${tableName}?select=*&limit=${chunk}&offset=${offset}`, { headers: { Prefer: 'count=exact' } });
  const rows = await res.json() as Record<string, unknown>[];
  const total = Number(res.headers.get('Content-Range')?.split('/')[1] ?? rows.length);
  if (rows.length === 0) {
    return json({ table: tableName, done: true, total, written: 0 });
  }
  const writes = rows.map((row, i) => {
    const idVal = row.id;
    const docId = typeof idVal === 'string' && idVal.length <= 120 && !idVal.includes('/')
      ? idVal
      : `row_${offset + i}`;
    return { collection: tableName, docId, fields: rowToFields(row) };
  });
  const results = await firestoreBatchWrite(writes);
  const failed = results.filter((r) => r.status && r.status !== 'OK').length;
  return json({ table: tableName, total, offset, written: rows.length - failed, failed, done: offset + rows.length >= total, nextOffset: offset + rows.length });
}

async function actionMigrateStorage() {
  const token = await getGoogleAccessToken();
  // Pick the target bucket
  let bucket: string | null = null;
  for (const b of STORAGE_BUCKET_CANDIDATES) {
    const sRes = await fetch(`https://firebasestorage.googleapis.com/v0/b/${b}/o?maxResults=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (sRes.ok) { bucket = b; break; }
  }
  if (!bucket) return json({ error: 'No accessible Firebase Storage bucket found', candidates: STORAGE_BUCKET_CANDIDATES }, 404);

  const db = adminClient();
  const bucketList = await db.storage('bucket');
  if (!bucketList.ok) throw new Error(`Source bucket list failed [${bucketList.status}]`);
  const sourceBuckets = ((await bucketList.json()) as { name?: string }[]).map((b) => b.name).filter(Boolean) as string[];

  const perBucket: Record<string, unknown> = {};
  for (const sb of sourceBuckets) {
    if (sb.startsWith('database_export')) continue; // backups stay source-only
    const listRes = await db.storage(`object/list/${sb}`, { method: 'POST', body: JSON.stringify({ prefix: '', limit: 1000, offset: 0 }) });
    if (!listRes.ok) { perBucket[sb] = `list failed ${listRes.status}`; continue; }
    const objects = await listRes.json() as { name: string; metadata?: { mimetype?: string; size?: string | number } }[];
    let copied = 0;
    const failures: { name: string; detail: string }[] = [];
    for (const obj of objects) {
      try {
        const dl = await db.storage(`object/${sb}/${encodeURIComponent(obj.name)}`);
        if (!dl.ok) throw new Error(`download ${dl.status}`);
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const contentType = obj.metadata?.mimetype ?? dl.headers.get('Content-Type') ?? 'application/octet-stream';
        const up = await fetch(
          `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(`${sb}/${obj.name}`)}`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body: bytes },
        );
        if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 200)}`);
        // Attach a download token so the client SDK getDownloadURL scheme works
        await fetch(
          `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(`${sb}/${obj.name}`)}`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentType, metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } }),
          },
        );
        copied++;
      } catch (e) {
        failures.push({ name: obj.name, detail: String(e).slice(0, 200) });
      }
    }
    perBucket[sb] = { found: objects.length, copied, failures };
  }
  return json({ targetBucket: bucket, perBucket });
}

async function actionStatus() {
  const token = await getGoogleAccessToken();
  const tables = await listPublicTables();
  const db = adminClient();
  const status: Record<string, unknown> = {};

  for (const t of tables) {
    try {
      const srcRes = await db.rest(`${t}?select=id&limit=1`, { headers: { Prefer: 'count=exact' } });
      const srcTotal = Number(srcRes.headers.get('Content-Range')?.split('/')[1] ?? 0);
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${t}?pageSize=1&showMissing=false`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      let fsCount = -1;
      if (fsRes.ok) {
        // Firestore REST has no cheap count; sample first page to confirm presence
        const j = await fsRes.json() as { documents?: unknown[] };
        fsCount = j.documents?.length ?? 0;
      }
      status[t] = { sourceTotal: srcTotal, firestoreSample: fsCount };
    } catch (e) {
      status[t] = { error: String(e).slice(0, 200) };
    }
  }

  // Users count comparison
  const users = await readUsersViaPostgrest(1000, 0);
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:batchGet?maxResults=1000`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const fbUsers = authRes.ok ? ((await authRes.json()) as { users?: { localId: string }[] }).users ?? [] : [];
  status.__users = { source: users.length, firebase: fbUsers.length };
  return json(status);
}

const actions = ['validate', 'migrate-users', 'migrate-table', 'migrate-storage', 'status'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const guard = await requireAdmin(req);
  if (guard !== 'ok') return json({ error: `auth check failed: ${guard}` }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const action = String(body.action ?? '');

  try {
    switch (action) {
      case 'validate': return await actionValidate();
      case 'migrate-users': return await actionMigrateUsers(Number(body.offset ?? 0), Number(body.chunk ?? 60));
      case 'migrate-table': {
        const table = String(body.table ?? '');
        if (!/^[a-zA-Z0-9_]+$/.test(table)) return json({ error: 'invalid table name' }, 400);
        return await actionMigrateTable(table, Number(body.offset ?? 0), Number(body.chunk ?? 200));
      }
      case 'migrate-storage': return await actionMigrateStorage();
      case 'status': return await actionStatus();
      default: return json({ error: 'unknown action', supported: actions }, 400);
    }
  } catch (e) {
    console.error('migration error', e);
    return json({ error: String(e).slice(0, 500) }, 500);
  }
});
