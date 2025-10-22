/* v0.30-lite (0.21 기반 최소 수정) */

// === 토스트 / 팝업 ===
function showToast(msg, ms = 2000) { // 2초
  const box = document.querySelector('#toastBox');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  box.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; }, ms - 250);
  setTimeout(() => { div.remove(); }, ms);
}

function showModal(html, title = '알림') { // 3초 후 닫기 가능
  const overlay = document.querySelector('#overlay');
  if (!overlay) return;
  document.querySelector('#mdTitle').textContent = title;
  document.querySelector('#mdBody').innerHTML = html;
  overlay.style.display = 'flex';
  const btn = document.querySelector('#mdClose');
  btn.disabled = true;
  btn.textContent = '닫기(3초 후)';
  setTimeout(() => { btn.disabled = false; btn.textContent = '닫기'; }, 3000);
}
function closeModal() {
  const overlay = document.querySelector('#overlay');
  if (overlay) overlay.style.display = 'none';
}
(function () {
  const overlay = document.querySelector('#overlay');
  const btn = document.querySelector('#mdClose');
  if (overlay && btn) {
    btn.addEventListener('click', closeModal);
    let canClose = false;
    setTimeout(() => { canClose = true; }, 3000);
    overlay.addEventListener('click', e => {
      if (e.target === overlay && canClose) closeModal();
    });
  }
})();

// === 섬광 효과 0.2초로 확장 ===
function flash() {
  const el = document.querySelector('#flash');
  if (!el) return;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 200);
}

// === 턴 처리 보완 ===
function turn(kind) {
  if (state.ended) return;
  const myRoll = roll2();
  let dmg = 0;

  if (kind === 'roll') dmg = Math.max(0, myRoll - 6);
  else if (kind === 'baton') dmg = 1; // 삼단봉
  else if (kind === 'fire') dmg = state.weapon ? 6 : 2;

  if (dmg > 0) {
    state.enemy.hp -= dmg;
    if (kind === 'baton') showToast(`삼단봉 데미지 ${dmg}`, 2000);
  } else showToast('공격 빗나감', 2000);

  if (state.enemy.hp <= 0) {
    document.querySelector('#btnClear').disabled = false;
    showToast('제압 완료!', 2000);
    renderAll(); persist();
    return;
  }

  enemyAct();
  showToast('턴 종료', 2000); // 턴마다 토스트
  renderAll(); persist();
}

// === 강등 시 근속기간 초기화 ===
function demote() {
  const idx = RANKS.indexOf(state.rank);
  if (idx <= 0) return;
  const prev = state.rank;
  state.rank = RANKS[idx - 1];
  state.month = 0; // 근속 리셋
  state.lastDemoteAt = Date.now();
  logHistory(`강등: ${prev} → ${state.rank} (근속 초기화)`);
}

// === 명예·추모관 이미지 저장 오류 수정 ===
function exportCardAsImage(fname, rec, idx, silent = false) {
  const canvas = document.createElement('canvas');
  const w = 900, h = 300;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0e172a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e9f0ff'; ctx.font = 'bold 28px system-ui';
  ctx.fillText('명예·추모관', 28, 48);
  ctx.font = '700 22px system-ui';
  ctx.fillText(`${rec.name} — ${rec.org} · ${rec.rank}`, 28, 92);
  ctx.font = '16px system-ui';
  wrapText(ctx, rec.msg, 28, 126, w - 56, 22);
  ctx.fillStyle = '#9fb4d4';
  ctx.fillText(new Date(rec.at).toLocaleString(), 28, h - 26);

  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.download = `${sanitize(fname || rec.name)}.png`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href); a.remove();
      if (!silent) showToast('이미지 저장 완료');
    }, 100);
  }, 'image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + ' ';
    const metrics = ctx.measureText(test);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}
function sanitize(s) { return String(s).replace(/[^\w가-힣._-]+/g, '_'); }
