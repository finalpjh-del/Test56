/* v0.30 — 공통 로직 */
// ---------- 유틸 ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function showToast(msg, ms=2000){ // 요구: 토스트 2초
  const box = $('#toastBox'); if(!box) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  box.appendChild(div);
  setTimeout(()=>{ div.style.opacity = '0'; div.style.transition = 'opacity .25s'; }, ms-250);
  setTimeout(()=>{ div.remove(); }, ms);
}

function showModal(html, title='알림'){ // 요구: 팝업 3초, 3초 이후 닫기 가능
  const overlay = $('#overlay'); if(!overlay) return;
  $('#mdTitle').textContent = title;
  $('#mdBody').innerHTML = html;
  overlay.style.display = 'flex';
  const btn = $('#mdClose');
  btn.disabled = true;
  btn.textContent = '닫기(3초 후)';
  setTimeout(()=>{ btn.disabled = false; btn.textContent = '닫기'; }, 3000);
}

function closeModal(){ const overlay = $('#overlay'); if(overlay){ overlay.style.display='none'; } }

// 오버레이 영역도 3초 후 닫기 허용
(function(){
  const overlay = $('#overlay');
  const btn = $('#mdClose');
  if(overlay && btn){
    btn.addEventListener('click', closeModal);
    let canCloseOverlay = false;
    setTimeout(()=>{ canCloseOverlay = true; }, 3000);
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay && canCloseOverlay) closeModal();
    });
  }
})();

// 격발 섬광 0.2초
function flash(){
  const el = $('#flash'); if(!el) return;
  el.style.opacity = '1';
  setTimeout(()=>{ el.style.opacity='0'; }, 200); // 0.2s
}

// ---------- 도메인 ----------
const RANKS = ['의경','순경','경장','경사','경위','경감','경정','총경','치안감','치안정감','치안총감'];

const PROMO_BY_TENURE_MONTHS = { // 근속승진 필요 개월(참고)
  '의경':'36', '순경':'48','경장':'60','경사':'78','경위':'96'
};

// 상태
const state = {
  org: null,
  gender: null,
  rank: null,
  name: '',
  hp: 50,
  hpMax: 50,
  enemy: null,
  kit: 0,
  month: 0,            // 근속 개월
  lastDemoteAt: null,  // v0.30: 강등시점(개월). 강등되면 근속승진 카운트 초기화 기준으로 다시 계산
  weapon: null,
  history: [],
  ended: false
};

// 저장 키
const LS_KEY = 'tpo_v030';
const MEM_KEY = 'tpo_v030_memorial';

// 페이지 초기화 라우팅
document.addEventListener('DOMContentLoaded', ()=>{
  const path = location.pathname.split('/').pop() || 'index.html';
  if(path.includes('police_training_game')){
    bootGame();
  }else if(path.includes('honor_memorial')){
    bootMemorial();
  }else{
    // index.html은 별도 스크립트 없음 (내비는 인라인)
  }
});

// ---------- 신원/시작 ----------
function bootGame(){
  // 견고한 DOM 바인딩 (게임시작 오류/빈 화면 방지)
  const btnStart = $('#btnStart');
  const btnQuit  = $('#btnQuit');
  const panelId  = $('#panelId');
  const panelGame= $('#panelGame');

  // 선택 토글
  const pick = (containerSel, attr, assignKey)=>{
    const box = $(containerSel); if(!box) return;
    box.addEventListener('click', e=>{
      const b = e.target.closest('button[data-'+attr+']'); if(!b) return;
      $$(containerSel+' .btn').forEach(x=>x.style.outline='none');
      b.style.outline='2px solid #65b7ff';
      state[assignKey] = b.getAttribute('data-'+attr);
    });
  };
  pick('#orgChips','org','org');
  pick('#genderChips','gender','gender');
  pick('#rankChips','rank','rank');

  btnStart?.addEventListener('click', ()=>{
    const name = ($('#nameInput')?.value || '').trim();
    state.name  = name || randomName();
    if(!state.org)    state.org = Math.random()<.5?'경찰':'해양경찰';
    if(!state.gender) state.gender = Math.random()<.5?'남자':'여자';
    if(!state.rank)   state.rank = '순경'; // 기본값

    // 첫 적 세팅
    state.enemy = spawnEnemy();
    // UI 표시
    panelId.style.display='none';
    panelGame.style.display='block';
    renderAll();
    persist();

    // 신원선택 오류 방지: 기본값/랜덤 보장
    showToast(`신원 확정: ${state.org} · ${state.gender} · ${state.rank} · ${state.name}`, 2000);
  });

  btnQuit?.addEventListener('click', ()=>{
    logHistory('의원면직');
    endGame('의원면직으로 게임을 종료했습니다.');
  });

  wireBattle();
}

function randomName(){
  const pool = ['김수호','정세라','이담','백이진','강우진','유지안','한별'];
  return pool[Math.floor(Math.random()*pool.length)];
}

function persist(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---------- 전투/턴 ----------
function spawnEnemy(){
  const names = ['소란범','절도범','폭행범','주취자','흉기소지자'];
  return { name:names[Math.floor(Math.random()*names.length)], hp: Math.floor(20+Math.random()*20) };
}

function wireBattle(){
  $('#btnRoll')?.addEventListener('click', ()=>turn('roll'));
  $('#btnBaton')?.addEventListener('click', ()=>turn('baton'));
  $('#btnFire')?.addEventListener('click', ()=>{ flash(); turn('fire'); });
  $('#btnSwap')?.addEventListener('click', ()=>{ state.weapon = state.weapon?null:'9mm'; showToast(`무기: ${state.weapon?state.weapon:'맨손'}`); });
  $('#btnMed')?.addEventListener('click', ()=>{
    // 구급함 사용: 내 턴 소요, 적만 주사위
    if(state.kit<=0){ showToast('구급함 없음'); return; }
    state.kit--; heal(30);
    enemyAct(); // 적만 행동
    endTurnToast('구급함 사용으로 턴 소요');
    renderAll(); persist();
  });
  $('#btnClear')?.addEventListener('click', openAfter);
  $('#btnUseKit')?.addEventListener('click', ()=>{ state.kit++; showToast('구급함 +1'); });
  $('#btnWash')?.addEventListener('click', ()=>{
    state.hp = Math.min(state.hpMax, state.hp+10);
    monthAdvance(4); // 애프터 열릴 때 +4개월
    endTurnToast('애프터 진행(+4개월)');
    hideAfter();
    nextEnemy();
  });
  $('#btnTryPromote')?.addEventListener('click', tryPromote);
}

// 가시화
function renderAll(){
  $('#titleInfo').textContent = `${state.name} — ${state.org}`;
  $('#tagRank').textContent = state.rank;
  $('#tagHP').textContent = `❤️ ${state.hp}/${state.hpMax}`;
  $('#tagMonth').textContent = `근속 ${state.month}개월`;
  $('#tagKit').textContent = `구급함 ${state.kit}`;
  $('#enemyName').textContent = `⚔️ ${state.enemy?.name??'—'}`;
  $('#enemyHP').textContent = `체력 ${state.enemy?.hp??'—'}`;
  $('#history').innerHTML = state.history.map(h=>`<li>${h}</li>`).join('');
  $('#btnClear').disabled = !(state.enemy && state.enemy.hp<=0);
}

// 턴 처리
function turn(kind){
  if(state.ended) return;

  const myRoll = roll2();
  let dmg = 0;

  if(kind==='roll'){
    dmg = Math.max(0, myRoll - 6);
  }else if(kind==='baton'){
    dmg = 1; // 요구: 삼단봉 데미지 토스트
  }else if(kind==='fire'){
    dmg = state.weapon ? 6 : 2;
  }

  if(dmg>0){
    state.enemy.hp -= dmg;
    if(kind==='baton') showToast(`삼단봉 데미지: ${dmg}`, 2000); // 요구 반영
  }else{
    showToast('타격 실패', 2000);
  }

  if(state.enemy.hp<=0){
    $('#btnClear')?.removeAttribute('disabled');
    showToast('제압 완료! 애프터로 진행', 2000);
    renderAll(); persist();
    return;
  }

  // 적 행동
  enemyAct();

  // 턴 종료 토스트 (요구: 매 턴마다)
  endTurnToast(`${kind==='roll'?'주사위':'행동'} 턴 종료`);
  renderAll(); persist();
}

function roll2(){ return (1+Math.floor(Math.random()*6)) + (1+Math.floor(Math.random()*6)); }

function enemyAct(){
  const eroll = roll2();
  const edmg = Math.max(0, eroll - 7);
  if(edmg>0){
    state.hp = Math.max(0, state.hp - edmg);
    if(state.hp===0){
      endGame('체력 0 — 게임오버');
    }
  }
}

function endTurnToast(reason){
  showToast(`턴 종료: ${reason}`, 2000); // 매 턴 토스트
}

// 애프터 열기/닫기
function openAfter(){
  $('#panelAfter').style.display='block';
  monthAdvance(4); // 애프터 패널 열릴 때 +4개월
  showToast('애프터 열림: +4개월', 2000);
  renderAll(); persist();
}
function hideAfter(){ $('#panelAfter').style.display='none'; }

function nextEnemy(){
  state.enemy = spawnEnemy();
  renderAll(); persist();
}

// 힐
function heal(v){ state.hp = Math.min(state.hpMax, state.hp+v); }

// 월수 누적
function monthAdvance(m){
  state.month += m;
}

// 승진 도전 (연차 기준)
function tryPromote(){
  const years = Math.floor(state.month/12);
  if(years<1){ showModal('연차 부족: 만 1년차부터 가능'); return; }

  const need = 7; // 예시 기준치
  showModal(`<div>주사위 2개 합 ${need}+ 이면 승진</div><div class="mut tiny">3초 후 닫기 가능</div>`,'승진 도전');
  const sum = roll2();
  if(sum>=need){
    promote();
  }else{
    logHistory(`승진 실패(주사위:${sum})`);
  }
  renderAll(); persist();
}

// 승진/강등
function promote(){
  const idx = RANKS.indexOf(state.rank);
  if(idx<0 || idx>=RANKS.length-1) return;
  const prev = state.rank;
  state.rank = RANKS[idx+1];
  logHistory(`승진: ${prev} → ${state.rank}`);
}

function demote(){
  const idx = RANKS.indexOf(state.rank);
  if(idx<=0) return;
  const prev = state.rank;
  state.rank = RANKS[idx-1];
  // 요구: 강등되면 근속기간 초기화(그 시점부터 다시 계산)
  state.month = 0;
  state.lastDemoteAt = Date.now();
  logHistory(`강등: ${prev} → ${state.rank} (근속 초기화)`);
}

// 과잉진압 등 규칙은 기존 룰에 맞춰 적절히 호출하면 됨
// 예시: 체력 -11 이하 등 조건에서 demote()

function logHistory(t){ state.history.push(`${new Date().toLocaleString()} — ${t}`); }

// 엔딩
function endGame(msg){
  state.ended = true;
  $('#ending')?.replaceChildren(document.createTextNode(msg));
  // 추모관 기록(예시)
  const record = {
    name: state.name, org: state.org, rank: state.rank, msg, at: Date.now()
  };
  const arr = JSON.parse(localStorage.getItem(MEM_KEY) || '[]');
  arr.push(record);
  localStorage.setItem(MEM_KEY, JSON.stringify(arr));
  showModal(msg, '엔딩');
  renderAll(); persist();
}

// ---------- 추모관 ----------
function bootMemorial(){
  const grid = $('#memGrid');
  const arr = JSON.parse(localStorage.getItem(MEM_KEY) || '[]').sort((a,b)=>b.at-a.at);
  grid.innerHTML = '';
  arr.forEach((r,i)=>{
    const card = document.createElement('div'); card.className='card';
    const title = document.createElement('div'); title.innerHTML = `<b>${r.name}</b> — ${r.org} · ${r.rank}`;
    const memo = document.createElement('div'); memo.className='mut'; memo.textContent = r.msg;
    const time = document.createElement('div'); time.className='mut tiny'; time.textContent = new Date(r.at).toLocaleString();
    const btnRow = document.createElement('div');
    const dl = document.createElement('button'); dl.className='btn'; dl.textContent='이미지 저장';
    dl.addEventListener('click', ()=> exportCardAsImage(title.textContent, r, i));
    btnRow.appendChild(dl);
    card.append(title,memo,time,btnRow);
    grid.appendChild(card);
  });

  $('#btnExportAll')?.addEventListener('click', ()=>{
    arr.forEach((r,i)=> exportCardAsImage(`${r.name}_${i}`, r, i, true));
  });
}

// 명예·추모관 카드 이미지를 안전하게 저장 (CORS/다운로드 오류 해결)
function exportCardAsImage(fname, rec, idx, silent=false){
  // HTML → Canvas → PNG Blob → 다운로드
  const canvas = document.createElement('canvas');
  const w = 900, h = 300;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = '#0e172a'; ctx.fillRect(0,0,w,h);

  // 텍스트
  ctx.fillStyle = '#e9f0ff'; ctx.font = 'bold 28px system-ui';
  ctx.fillText('명예·추모관', 28, 48);
  ctx.font = '700 22px system-ui';
  ctx.fillText(`${rec.name} — ${rec.org} · ${rec.rank}`, 28, 92);
  ctx.font = '16px system-ui';
  wrapText(ctx, rec.msg, 28, 126, w-56, 22);
  ctx.fillStyle = '#9fb4d4';
  ctx.fillText(new Date(rec.at).toLocaleString(), 28, h-26);

  canvas.toBlob((blob)=>{
    const a = document.createElement('a');
    a.download = `${sanitize(fname||rec.name)}.png`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); if(!silent) showToast('이미지 저장 완료'); }, 100);
  }, 'image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = String(text||'').split(/\s+/);
  let line = '';
  for(let n=0;n<words.length;n++){
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if(metrics.width > maxWidth && n>0){
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    }else{
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function sanitize(s){ return String(s).replace(/[^\w가-힣._-]+/g,'_'); }
