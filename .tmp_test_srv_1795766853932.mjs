import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 0;
const HOST = '0.0.0.0';

const DATA_DIR = "/tmp/test_data_1795766853932";
fs.mkdirSync(DATA_DIR, { recursive: true });

const tenantCache = new Map();
const sseSubscribers = new Map();

function sanitizeTenantId(raw) {
  const tid = String(raw || '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(tid)) return null;
  return tid;
}

function getTenantFilePath(tid) {
  const filePath = path.resolve(DATA_DIR, `${tid}.json`);
  if (!filePath.startsWith(DATA_DIR + path.sep)) return null;
  return filePath;
}

function readTenantRecord(tid) {
  if (tenantCache.has(tid)) return tenantCache.get(tid);
  const filePath = getTenantFilePath(tid);
  if (!filePath || !fs.existsSync(filePath)) {
    const empty = { version: 0, updatedAt: null, payload: null };
    tenantCache.set(tid, empty);
    return empty;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rec = {
      version: Number.isInteger(parsed?.version) && parsed.version >= 0 ? parsed.version : 0,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      payload: parsed?.payload && typeof parsed.payload === 'object' ? parsed.payload : null
    };
    tenantCache.set(tid, rec);
    return rec;
  } catch (e) {
    console.warn(`Failed reading tenant ${tid}:`, e);
    return { version: 0, updatedAt: null, payload: null };
  }
}

function writeTenantRecord(tid, rec) {
  const filePath = getTenantFilePath(tid);
  if (!filePath) throw new Error('Invalid tenant path');
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(rec), 'utf8');
  fs.renameSync(tmpPath, filePath);
  tenantCache.set(tid, rec);
}

function sanitizePayloadForServer(payload) {
  const clean = JSON.parse(JSON.stringify(payload));
  if (clean && clean.settings && typeof clean.settings === 'object') {
    delete clean.settings.supabaseKey;
    delete clean.settings.supabaseUrl;
  }
  return clean;
}

function broadcastTenantUpdate(tid, rec) {
  const subs = sseSubscribers.get(tid);
  if (!subs || subs.size === 0) return;
  const bookEpoch = Number(rec?.payload?.settings?.bookEpoch) || 0;
  const msg = `event: update\ndata: ${JSON.stringify({ version: rec.version, bookEpoch, updatedAt: rec.updatedAt })}\n\n`;
  for (const res of subs) {
    try {
      res.write(msg);
    } catch (_) {
      subs.delete(res);
    }
  }
}

app.use(express.json({ limit: '25mb' }));

app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.html') || filePath.endsWith('.webmanifest')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('/api/sync/:tenantId/events', (req, res) => {
  const tid = sanitizeTenantId(req.params.tenantId);
  if (!tid) return res.status(400).json({ ok: false, error: 'Tenant ID tidak valid' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const rec = readTenantRecord(tid);
  const bookEpoch = Number(rec?.payload?.settings?.bookEpoch) || 0;
  res.write(`event: hello\ndata: ${JSON.stringify({ version: rec.version, bookEpoch, updatedAt: rec.updatedAt })}\n\n`);

  let subs = sseSubscribers.get(tid);
  if (!subs) {
    subs = new Set();
    sseSubscribers.set(tid, subs);
  }
  subs.add(res);

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    subs.delete(res);
  });
});

app.get('/api/sync/:tenantId', (req, res) => {
  const tid = sanitizeTenantId(req.params.tenantId);
  if (!tid) return res.status(400).json({ ok: false, error: 'Tenant ID tidak valid' });
  res.setHeader('Cache-Control', 'no-store');
  const rec = readTenantRecord(tid);
  res.json({ ok: true, version: rec.version, updatedAt: rec.updatedAt, payload: rec.payload });
});

app.put('/api/sync/:tenantId', (req, res) => {
  const tid = sanitizeTenantId(req.params.tenantId);
  if (!tid) return res.status(400).json({ ok: false, error: 'Tenant ID tidak valid' });

  const body = req.body;
  if (!body || typeof body !== 'object' || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    return res.status(400).json({ ok: false, error: 'Payload sync tidak valid' });
  }
  const baseVersion = Number(body.baseVersion);
  if (!Number.isInteger(baseVersion) || baseVersion < 0) {
    return res.status(400).json({ ok: false, error: 'baseVersion tidak valid' });
  }

  const current = readTenantRecord(tid);
  if (baseVersion !== current.version) {
    return res.status(409).json({
      ok: false,
      conflict: true,
      version: current.version,
      updatedAt: current.updatedAt,
      payload: current.payload
    });
  }

  const nextRec = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    payload: sanitizePayloadForServer(body.payload)
  };
  writeTenantRecord(tid, nextRec);
  broadcastTenantUpdate(tid, nextRec);
  res.json({ ok: true, version: nextRec.version, updatedAt: nextRec.updatedAt });
});

app.post('/share-target', (_req, res) => {
  res.redirect(303, '/?share-target=1');
});

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

const __srv = app.listen(PORT, HOST, () => { globalThis.__testServer = __srv;
  console.log(`Server running at http://${HOST}:${PORT}`);
});
