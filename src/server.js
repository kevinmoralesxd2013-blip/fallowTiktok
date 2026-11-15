import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { feed, allAccounts, unseenCount, unseenByAccount, markAllSeen } from './db.js';
import { addAccount, deleteAccount, deleteVideos, setDisabled, setInterval_, getAccount } from './db.js';
import { provider } from './providers.js';
import { checkByUsername } from './poller.js';
import { loginPage, feedPage } from './views.js';

const same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function startServer() {
  const PASSWORD = process.env.PANEL_PASSWORD;
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    }
  }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 86400_000 }
  }));
  app.use(express.static('public'));

  if (PASSWORD) {
    const limiter = rateLimit({ windowMs: 600_000, max: 8 });
    app.get('/login', (req, res) => res.send(loginPage()));
    app.post('/login', limiter, (req, res) => {
      if (!same(String(req.body.password || ''), PASSWORD)) {
        return res.status(401).send(loginPage('Contraseña incorrecta.'));
      }
      req.session.auth = true;
      req.session.csrf = crypto.randomBytes(24).toString('hex');
      res.redirect('/');
    });
    app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));
    app.use((req, res, next) => req.session.auth ? next() : res.redirect('/login'));
  } else {
    app.use((req, res, next) => {
      if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
      next();
    });
  }

  const csrf = (req, res, next) =>
    req.get('x-csrf-token') === req.session.csrf ? next() : res.status(403).json({ error: 'CSRF' });

  app.get('/', (req, res) => {
    const newOnly = req.query.nuevos === '1';
    const counts = Object.fromEntries(unseenByAccount.all().map(r => [r.account, r.n]));
    const accounts = allAccounts.all().map(a => ({
      ...a, n: counts[a.username] || 0, active: a.username === req.query.account
    }));

    let videos = feed.all({ onlyNew: newOnly ? 1 : 0 });
    if (req.query.account) videos = videos.filter(v => v.account === req.query.account);

    res.send(feedPage({ csrf: req.session.csrf, accounts, videos, unseen: unseenCount.get().n, newOnly }));
  });

  app.post('/api/accounts', async (req, res) => {
    const username = String(req.body.username || '').replace(/^@/, '').toLowerCase().trim();
    if (!/^[a-z0-9._]{2,24}$/.test(username)) return res.status(400).json({ error: 'usuario inválido' });
    if (getAccount.get(username)) return res.status(409).json({ error: 'ya existe' });

    try {
      const secUid = await provider.resolve(username);
      addAccount.run(username, secUid, Math.floor(Date.now() / 1000));
      res.json({ ok: true });
    } catch (err) {
      res.status(422).json({ error: err.message });
    }
  });

  app.post('/api/accounts/:u/delete', (req, res) => {
    deleteVideos.run(req.params.u);
    deleteAccount.run(req.params.u);
    res.json({ ok: true });
  });

  app.post('/api/accounts/:u/toggle', (req, res) => {
    const acc = getAccount.get(req.params.u);
    if (!acc) return res.status(404).json({ error: 'no existe' });
    setDisabled.run(acc.disabled ? 0 : 1, req.params.u);
    res.json({ ok: true });
  });

  app.post('/api/accounts/:u/interval', (req, res) => {
    const m = Math.min(360, Math.max(10, Number(req.body.minutes) || 15));
    setInterval_.run(m * 60, req.params.u);
    res.json({ ok: true, minutes: m });
  });

  app.post('/api/accounts/:u/check', async (req, res) => {
    try { res.json(await checkByUsername(req.params.u)); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/mark-all', (req, res) => { markAllSeen.run(); res.json({ ok: true }); });

  app.use('/api', csrf);
  app.use((req, res) => res.redirect('/'));

  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => console.log(`http://${HOST}:${PORT}`));
}
