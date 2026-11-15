const csrf = document.querySelector('meta[name="csrf-token"]').content;
const msg = document.getElementById('msg');

const post = (url, body = {}) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
  body: JSON.stringify(body)
}).then(r => r.json());

document.getElementById('add').addEventListener('submit', async e => {
  e.preventDefault();
  msg.textContent = 'Resolviendo…';
  const res = await post('/api/accounts', { username: e.target.username.value });
  if (res.ok) return location.reload();
  msg.textContent = res.error || 'Error';
});

document.querySelectorAll('.acc').forEach(el => {
  const u = encodeURIComponent(el.dataset.account);
  el.querySelector('.del').onclick = async () => {
    if (!confirm(`¿Borrar @${el.dataset.account} y sus vídeos?`)) return;
    await post(`/api/accounts/${u}/delete`);
    location.reload();
  };
  el.querySelector('.tgl').onclick = async () => { await post(`/api/accounts/${u}/toggle`); location.reload(); };
  el.querySelector('.chk').onclick = async e => {
    e.target.disabled = true;
    const r = await post(`/api/accounts/${u}/check`);
    location.reload();
    if (!r.ok) console.warn(r.error);
  };
});

document.querySelectorAll('.vid').forEach(el => {
  el.querySelector('a').addEventListener('click', () => {
    el.classList.remove('unseen');
  });
});

document.getElementById('mark-all')?.addEventListener('click', async () => {
  await post('/api/mark-all');
  location.reload();
});
