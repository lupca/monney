// Các xử lý API, viết theo kiểu (req, res) chạy được cả trên Vercel lẫn Express.
import crypto from 'node:crypto';
import { COLLECTIONS, ID_RE, isObj, allDocs, setDoc, updateDoc, deleteDoc, importAll } from './store.js';

// Mật khẩu HTTP Basic: tên đăng nhập gõ gì cũng được, mật khẩu là APP_PASSWORD.
export function authorized(req) {
  const want = process.env.APP_PASSWORD || '';
  if (!want) return true;
  const h = req.headers.authorization || '';
  const got = h.startsWith('Basic ')
    ? Buffer.from(h.slice(6), 'base64').toString('utf8').split(':').slice(1).join(':') : '';
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function deny(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="So tien", charset="UTF-8"');
  res.status(401).json({ code: 'revoked', message: 'Cần mật khẩu' });
}

function fail(res, e) {
  console.error(e);
  res.status(500).json({ code: 'unavailable', message: 'Lỗi máy chủ' });
}

const bad = (res, message) => res.status(400).json({ code: 'invalid_argument', message });

export async function docsIndex(req, res) {
  if (!authorized(req)) return deny(res);
  if (req.method !== 'GET') return res.status(405).end();
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ collections: await allDocs() });
  } catch (e) { fail(res, e); }
}

export async function docItem(req, res) {
  if (!authorized(req)) return deny(res);
  const q = { ...(req.query || {}), ...(req.params || {}) };
  const { collection, id } = q;
  if (!COLLECTIONS.includes(collection) || !ID_RE.test(id || '')) return bad(res, 'Đường dẫn không hợp lệ');
  try {
    if (req.method === 'PUT') {
      if (!isObj(req.body)) return bad(res, 'Dữ liệu phải là object');
      await setDoc(collection, id, req.body);
    } else if (req.method === 'PATCH') {
      if (!isObj(req.body)) return bad(res, 'Dữ liệu phải là object');
      if (!(await updateDoc(collection, id, req.body))) return res.status(404).json({ code: 'invalid_argument', message: 'Không có mục này' });
    } else if (req.method === 'DELETE') {
      await deleteDoc(collection, id);
    } else return res.status(405).end();
    res.status(200).json({ ok: true });
  } catch (e) { fail(res, e); }
}

export async function exportAll(req, res) {
  if (!authorized(req)) return deny(res);
  try {
    const d = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="so-tien-${d}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ version: 1, exportedAt: new Date().toISOString(), collections: await allDocs() });
  } catch (e) { fail(res, e); }
}

export async function importFile(req, res) {
  if (!authorized(req)) return deny(res);
  if (req.method !== 'POST') return res.status(405).end();
  const cols = req.body && req.body.collections;
  if (!isObj(cols)) return bad(res, 'File không đúng định dạng sao lưu');
  try { res.status(200).json({ ok: true, imported: await importAll(cols) }); } catch (e) { fail(res, e); }
}
