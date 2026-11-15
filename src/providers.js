const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const RSSHUB = process.env.RSSHUB_BASE || 'https://rsshub.app';

async function fetchRsshub(username) {
  const res = await fetch(`${RSSHUB}/tiktok/user/@${username}`, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml' }
  });
  if (!res.ok) throw new Error(`RSSHub HTTP ${res.status}`);

  const xml = await res.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const b = m[1];
    const pick = t => b.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`))?.[1]?.trim();
    const link = pick('link');
    const id = link?.match(/\/video\/(\d+)/)?.[1];
    if (!id) return null;
    return {
      videoId: id,
      url: link,
      title: (pick('title') || '').replace(/<[^>]+>/g, '').trim(),
      thumbnail: b.match(/<enclosure[^>]+url="([^"]+)"/)?.[1] ?? null,
      publishedAt: pick('pubDate')
    };
  }).filter(Boolean);
}

async function resolveSecUidDirect(username) {
  const res = await fetch(`https://www.tiktok.com/@${username}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Perfil HTTP ${res.status}`);
  const secUid = (await res.text()).match(/"secUid":"([^"]+)"/)?.[1];
  if (!secUid) throw new Error('secUid no encontrado');
  return secUid;
}

async function fetchDirect(account) {
  const secUid = account.sec_uid || await resolveSecUidDirect(account.username);
  const res = await fetch(
    `https://www.tiktok.com/api/post/item_list/?aid=1988&count=5&secUid=${encodeURIComponent(secUid)}`,
    { headers: { 'User-Agent': UA, Referer: `https://www.tiktok.com/@${account.username}` } }
  );
  if (!res.ok) throw new Error(`item_list HTTP ${res.status}`);
  const json = await res.json();
  return (json.itemList || []).map(it => ({
    videoId: it.id,
    url: `https://www.tiktok.com/@${account.username}/video/${it.id}`,
    title: it.desc || '',
    thumbnail: it.video?.cover || null,
    publishedAt: new Date(it.createTime * 1000).toISOString()
  }));
}

export const provider = process.env.TIKTOK_PROVIDER === 'direct'
  ? { resolve: resolveSecUidDirect, fetch: fetchDirect }
  : { resolve: async () => null, fetch: a => fetchRsshub(a.username) };

export async function oembed(url) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': UA } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
