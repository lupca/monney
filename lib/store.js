// Kho dữ liệu Postgres dùng chung cho Vercel (api/) và server.js (Docker/máy riêng).
import pg from 'pg';

export const COLLECTIONS = ['meta', 'debts', 'payments', 'txns', 'budgets', 'funds', 'wishes'];
export const ID_RE = /^[A-Za-z0-9_\-.:@+~]{1,200}$/;

let pool;
let ready;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('Thiếu biến môi trường DATABASE_URL');
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function db() {
  const p = getPool();
  ready ||= p.query(`
    CREATE TABLE IF NOT EXISTS so_tien_docs (
      collection text NOT NULL,
      id         text NOT NULL,
      data       jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    )`).catch(e => { ready = null; throw e; });
  await ready;
  return p;
}

export const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// Gộp kiểu Firestore update: object gộp đệ quy, mảng và giá trị khác thì thay, {__delete__:true} thì xoá field.
export function merge(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (isObj(v)) {
      if (v.__delete__ === true) { delete out[k]; continue; }
      out[k] = merge(isObj(out[k]) ? out[k] : {}, v);
    } else out[k] = v;
  }
  return out;
}

export async function allDocs() {
  const p = await db();
  const { rows } = await p.query('SELECT collection, id, data FROM so_tien_docs ORDER BY collection, id');
  const out = Object.fromEntries(COLLECTIONS.map(c => [c, {}]));
  for (const r of rows) (out[r.collection] ||= {})[r.id] = r.data;
  return out;
}

const UPSERT = `INSERT INTO so_tien_docs (collection, id, data) VALUES ($1,$2,$3)
  ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;

export async function setDoc(c, id, data) {
  const p = await db();
  await p.query(UPSERT, [c, id, data]);
}

export async function updateDoc(c, id, patch) {
  const p = await db();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT data FROM so_tien_docs WHERE collection=$1 AND id=$2 FOR UPDATE', [c, id]);
    if (!rows.length) { await client.query('ROLLBACK'); return false; }
    await client.query('UPDATE so_tien_docs SET data=$3, updated_at=now() WHERE collection=$1 AND id=$2',
      [c, id, merge(rows[0].data, patch)]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

export async function deleteDoc(c, id) {
  const p = await db();
  await p.query('DELETE FROM so_tien_docs WHERE collection=$1 AND id=$2', [c, id]);
}

export async function importAll(collections) {
  const p = await db();
  const client = await p.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const [c, docs] of Object.entries(collections)) {
      if (!COLLECTIONS.includes(c) || !isObj(docs)) continue;
      for (const [id, data] of Object.entries(docs)) {
        if (!ID_RE.test(id) || !isObj(data)) continue;
        await client.query(UPSERT, [c, id, data]);
        n++;
      }
    }
    await client.query('COMMIT');
    return n;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}
