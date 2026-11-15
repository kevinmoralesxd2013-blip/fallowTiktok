const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const rel = ts => {
  const d = Math.round((Date.now() - ts) / 1000);
  if (d < 60) return 'ahora';
  if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  return `hace ${Math.floor(d / 86400)} d`;
};

export const loginPage = (err = '') => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Acceso</title>
<link rel="stylesheet" href="/style.css"></head>
<body class="center"><form method="post" action="/login" class="card login">
<h1>fallowTiktok</h1>
${err ? `<p class="error">${esc(err)}</p>` : ''}
<input type="password" name="password" placeholder="Contraseña" autofocus required>
<button>Entrar</button></form></body></html>`;

export const feedPage = ({ csrf, accounts, videos, unseen }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf-token" content="${esc(csrf)}">
<title>fallowTiktok${unseen ? ` (${unseen})` : ''}</title>
<link rel="stylesheet" href="/style.css"></head>
<body>
<div class="layout">
<aside>
  <h1>fallowTiktok</h1>
  <form id="add" class="add">
    <input name="username" placeholder="@usuario" required>
    <button>+</button>
  </form>
  <p id="msg"></p>
  <nav id="accounts">
    ${accounts.map(a => `<div class="acc" data-account="${esc(a.username)}">
      <a href="?account=${esc(a.username)}" class="${a.active ? 'sel' : ''}">
        @${esc(a.username)}${a.n ? ` <b class="badge">${a.n}</b>` : ''}
        ${a.disabled ? ' <span class="bad">pausa</span>' : ''}
      </a>
      <span class="ctl">
        <button class="ghost chk" title="Comprobar ahora">↻</button>
        <button class="ghost tgl" title="${a.disabled ? 'Activar' : 'Pausar'}">${a.disabled ? '▶' : '⏸'}</button>
        <button class="danger del" title="Borrar">✕</button>
      </span>
    </div>`).join('') || '<p class="muted">Sin cuentas.</p>'}
  </nav>
</aside>

<main>
  <div class="bar">
    <a href="/" class="${!newOnly ? 'sel' : ''}">Todos</a>
    <a href="/?nuevos=1" class="${newOnly ? 'sel' : ''}">Nuevos${unseen ? ` (${unseen})` : ''}</a>
    <button class="ghost" id="mark-all">Marcar todo leído</button>
    <form method="post" action="/logout"><button class="ghost">Salir</button></form>
  </div>

  <div class="grid">
  ${videos.map(v => `<article class="vid ${v.seen ? '' : 'unseen'}" data-id="${esc(v.id)}"
      data-url="${esc(v.url)}">
    ${v.thumbnail ? `<img src="${esc(v.thumbnail)}" loading="lazy" alt="">` : '<div class="noimg"></div>'}
    <div class="meta">
      <a href="${esc(v.url)}" target="_blank" rel="noreferrer">${esc(v.title || 'Vídeo')}</a>
      <small>@${esc(v.account)} · ${rel(v.published_at)}</small>
    </div>
  </article>`).join('') || '<p class="muted">Nada por aquí todavía.</p>'}
  </div>
</main>
</div>
<script src="/app.js"></script></body></html>`;
