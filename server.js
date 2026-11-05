// Chạy ngoài Vercel (máy riêng, Docker, Kubernetes): node server.js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorized, docsIndex, docItem, exportAll, importFile } from './lib/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
if (!process.env.APP_PASSWORD) console.warn('CẢNH BÁO: chưa đặt APP_PASSWORD, ai có link cũng xem được sổ.');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.get('/healthz', (_req, res) => res.send('ok'));
app.use((req, res, next) => {
  if (authorized(req)) return next();
  res.set('WWW-Authenticate', 'Basic realm="So tien", charset="UTF-8"').status(401).send('Cần mật khẩu');
});
app.get('/api/docs', docsIndex);
app.all('/api/docs/:collection/:id', docItem);
app.get('/api/export', exportAll);
app.post('/api/import', importFile);
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Sổ tiền chạy ở http://localhost:${PORT}`));
