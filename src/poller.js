import { dueAccounts, markChecked, markFailure, insertVideo, pruneVideos, getAccount } from './db.js';
import { provider } from './providers.js';

const MAX_AGE_MS = 6 * 3600 * 1000;
const now = () => Math.floor(Date.now() / 1000);

export function startPoller() {
  setInterval(() => tick().catch(e => console.error('[poller]', e)), 60_000);
}

async function tick() {
  for (const acc of dueAccounts.all(now())) await checkAccount(acc);
}

export async function checkAccount(acc) {
  try {
    const videos = await provider.fetch(acc);

    if (!acc.last_video_id) {
      markChecked.run(now(), videos[0]?.videoId ?? null, acc.username);
      return { ok: true, nuevos: 0 };
    }

    let nuevos = 0;
    for (const v of videos) {
      if (v.videoId === acc.last_video_id) break;
      const edad = Date.now() - new Date(v.publishedAt).getTime();
      if (Number.isFinite(edad) && edad > MAX_AGE_MS) continue;

      const meta = await oembedSafe(v);
      insertVideo.run(v.videoId, acc.username, meta.title || v.title,
        meta.thumbnail || v.thumbnail, v.url,
        new Date(v.publishedAt).getTime(), now());
      nuevos++;
    }

    if (nuevos) pruneVideos.run(acc.username, acc.username);
    markChecked.run(now(), videos[0]?.videoId ?? null, acc.username);
    return { ok: true, nuevos };
  } catch (err) {
    markFailure.run(now(), acc.username);
    return { ok: false, error: err.message };
  }
}

async function oembedSafe(v) {
  const { oembed } = await import('./providers.js');
  const meta = await oembed(v.url).catch(() => null);
  return { title: meta?.title ?? null, thumbnail: meta?.thumbnail_url ?? null };
}

export async function checkByUsername(username) {
  const acc = getAccount.get(username);
  if (!acc) throw new Error('cuenta inexistente');
  return checkAccount(acc);
}
