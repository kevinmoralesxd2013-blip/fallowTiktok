import Database from 'better-sqlite3';

const db = new Database('fallowtiktok.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  username      TEXT PRIMARY KEY,
  sec_uid       TEXT,
  last_video_id TEXT,
  last_checked  INTEGER NOT NULL DEFAULT 0,
  interval_s    INTEGER NOT NULL DEFAULT 900,
  failures      INTEGER NOT NULL DEFAULT 0,
  disabled      INTEGER NOT NULL DEFAULT 0,
  added_at      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS videos (
  id           TEXT PRIMARY KEY,
  account      TEXT NOT NULL,
  title        TEXT,
  thumbnail    TEXT,
  url          TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  seen         INTEGER NOT NULL DEFAULT 0,
  fetched_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_pub ON videos (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_acc ON videos (account, published_at DESC);
`);

export const getAccount = db.prepare('SELECT * FROM accounts WHERE username = ?');
export const allAccounts = db.prepare('SELECT * FROM accounts ORDER BY added_at DESC');
export const dueAccounts = db.prepare(
  'SELECT * FROM accounts WHERE disabled = 0 AND last_checked + interval_s <= ?'
);
export const addAccount = db.prepare(`
  INSERT INTO accounts (username, sec_uid, last_video_id, added_at)
  VALUES (?, ?, NULL, ?) ON CONFLICT(username) DO NOTHING
`);
export const deleteAccount = db.prepare('DELETE FROM accounts WHERE username = ?');
export const deleteVideos = db.prepare('DELETE FROM videos WHERE account = ?');
export const setDisabled = db.prepare(
  'UPDATE accounts SET disabled = ?, failures = 0 WHERE username = ?'
);
export const setInterval_ = db.prepare('UPDATE accounts SET interval_s = ? WHERE username = ?');
export const markChecked = db.prepare(
  'UPDATE accounts SET last_checked = ?, last_video_id = COALESCE(?, last_video_id), failures = 0 WHERE username = ?'
);
export const markFailure = db.prepare(
  'UPDATE accounts SET failures = failures + 1, last_checked = ?, disabled = (failures + 1 >= 10) WHERE username = ?'
);

export const insertVideo = db.prepare(`
  INSERT OR IGNORE INTO videos (id, account, title, thumbnail, url, published_at, fetched_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
export const pruneVideos = db.prepare(`
  DELETE FROM videos WHERE account = ? AND id NOT IN (
    SELECT id FROM videos WHERE account = ? ORDER BY published_at DESC LIMIT 200
  )
`);

export const feed = db.prepare(`
  SELECT * FROM videos WHERE (@onlyNew = 0 OR seen = 0)
  ORDER BY published_at DESC LIMIT 120
`);
export const unseenCount = db.prepare('SELECT COUNT(*) AS n FROM videos WHERE seen = 0');
export const unseenByAccount = db.prepare(
  'SELECT account, COUNT(*) AS n FROM videos WHERE seen = 0 GROUP BY account'
);
export const markSeen = db.prepare('UPDATE videos SET seen = 1 WHERE id = ?');
export const markAllSeen = db.prepare('UPDATE videos SET seen = 1 WHERE seen = 0');

export default db;
