require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();

const db = new Database('database.sqlite');

db.exec(`
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT,
  fingerprint TEXT,
  angle TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(express.static('public'));
app.use('/admin', express.static('admin'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25
});

app.use(limiter);

const bans = new Map();
const attempts = new Map();

function fingerprint(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  return crypto
    .createHash('sha256')
    .update(ip + ua)
    .digest('hex');
}

function logAttempt(ip, fp, angle, status) {
  db.prepare(`
    INSERT INTO logs (ip, fingerprint, angle, status)
    VALUES (?, ?, ?, ?)
  `).run(ip, fp, angle, status);
}

function auth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/verify', (req, res) => {

  const ip =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress;

  const fp = fingerprint(req);

  const bannedUntil = bans.get(fp);

  if (bannedUntil && bannedUntil > Date.now()) {

    logAttempt(ip, fp, 'BLOCKED', 'blocked');

    return res.json({
      blocked: true
    });
  }

  const angle = parseInt(req.body.angle, 10);

  if (isNaN(angle)) {

    logAttempt(ip, fp, 'INVALID', 'invalid');

    return res.status(400).json({
      error: 'invalid'
    });
  }

  let state = attempts.get(fp);

  if (!state) {
    state = { count: 0 };
  }

  const correct =
    Math.abs(
      angle - parseInt(process.env.CORRECT_ANGLE)
    ) <= parseInt(process.env.TOLERANCE);

  if (correct) {

    logAttempt(ip, fp, angle, 'correct');

    return res.json({
      correct: true
    });
  }

  state.count += 1;

  attempts.set(fp, state);

  const left =
    parseInt(process.env.MAX_ATTEMPTS) - state.count;

  logAttempt(ip, fp, angle, 'wrong');

  if (state.count >= parseInt(process.env.MAX_ATTEMPTS)) {

    bans.set(
      fp,
      Date.now() +
      parseInt(process.env.BAN_HOURS) * 3600000
    );

    logAttempt(ip, fp, angle, 'banned');

    return res.json({
      blocked: true
    });
  }

  res.json({
    correct: false,
    left
  });
});

app.post('/api/admin/login', async (req, res) => {

  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({
      error: 'invalid'
    });
  }

  const ok = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if (!ok) {
    return res.status(401).json({
      error: 'invalid'
    });
  }

  const token = jwt.sign(
    {
      admin: true
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '12h'
    }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict'
  });

  res.json({
    success: true
  });
});

app.get('/api/admin/logs', auth, (req, res) => {

  const logs = db.prepare(`
    SELECT * FROM logs
    ORDER BY created_at DESC
    LIMIT 500
  `).all();

  res.json(logs);
});

app.listen(process.env.PORT, () => {
  console.log('KRATOWNICA SECURE RUNNING');
});