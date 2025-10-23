/* v0.30 — v0.21 기반 최소 수정 (기능만 추가) */

// ---------- 유틸 ----------
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function ensureToastUI(){
  if(!$('#toastBox')){
    const box = document.createElement('div');
    box.id='toastBox';
    box.style.position='fixed';
    box.style.left='50%';
    box.style.bottom='20px';
    box.style.transform='translateX(-50%)';
    box.style.display='flex';
    box.style.flexDirection='column';
    box.style.gap='8px';
    box.style.zIndex='9999';
    document.body.appendChild(box);
  }
}
function showToast(msg, ms=2000){
  ensureToastUI();
  const box = $('#toastBox'); if(!box) return;
  const div = document.createElement('div');
  div.className='toast';
  div.textContent = msg;
  box.appendChild(div);
  setTimeout(()=>{ div.style.opacity='0'; }, Math.max(250, ms-250));
  setTimeout(()=>{ div.remove(); }, ms);
}

function showModal(html, title='알림'){
  const overlay=$('#overlay'); const t=$('#mdTitle'); const b=$('#mdBody'); const c=$('#mdClose');
  if(!overlay||!t||!b||!c){ alert(title+'\n\n'+html.replace(/<[^>]+>/g,'')); return; }
  t.textContent = title; b.innerHTML = html;
  overlay.style.display='flex';
  c.disabled = true; c.textContent='닫기(3초 후)';
  setTimeout(()=>{ c.disabled=false; c.textContent='닫기'; }, 3000);

  let canClose=false;
  setTimeout(()=>{ canClose=true; },3000);
  c.onclick = ()=> overlay.style.display='none';
  overlay.addEventListener('click',(e)=>{ if(e.target===overlay && canClose) overlay.style.display='none'; },{ once:true });
}

// 격발 섬광 0.2s
function flash(){
  const el=$('#flash'); if(!el) return;
  el.style.opacity='1';
  setTimeout(()=>{ el.style.opacity='0'; }, 200);
}

// ---------- 상태/상수 ----------
const RANKS = ['의경','순경','경장','경사','경위','경감','경정','총경','치안감','치안정감','치안총감'];
const LS_KEY  = 'tpo_v021_state';
const MEM_KEY = 'tpo_v021_memorial';

const state = {
  org:null, gender:null, rank:null, name:'',
  hp:50, hpMax:50,
  enemy:null, kit:0,
  month:0, lastDemoteAt:null,
  weapon:null, history:[], ended:false
};

// ---------- 부트 ----------
document.addEventListener('DOMContentLoaded', ()=>{
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  try{
    if(path.includes('police_training_game')) bootGame();
    else if(path.includes('honor_memorial')) bootMemorial();
  }catch(err){
    console.error(err);
    showModal('초기화 중 오류가 발생했습니다. 새로고침 해주세요.<br><small>'+String(err)+'</small>','오류');
  }
});

// ---------- 공통 도우미 ----------
function persist(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function randomName(){ const pool=['김수호','정세라','이담','백이진','강우진','유지안','한별']; return pool[Math.floor(Math.random()*pool.length)]; }
function roll2(){ return (1+Math.floor(Math.random()*6)) + (1+Math.floor(Math.random()*6)); }
function heal(v){ state.hp = Math.min(state.hpMax, state.hp+v); }
function monthAdvance(m){ state.month += m; }
function logHistory(t){ state.history.push(`${new Date().toLocaleString()} — ${t}`); }

// ---------- 게임 ----------
function bootGame(){
  // 신원 선택 토글
  const pick=(sel,attr,key)=>{
    const box=$(sel); if(!box) return;
    box.addEventListener('click', e=>{
      const b=e.target.closest('button[data-'+attr+']'); if(!b) return;
      $$(sel+' .btn').forEach(x=>x.style.outline='none');
      b.style.outline='2px solid #65b7ff';
      state[key]=b.getAttribute('data-'+attr);
    });
  };
  pick('#orgChips','org','org');
  pick('#genderChips','gender','gender');
  pick('#rankChips','rank','rank');

  // 시작
  $('#btnStart')?.addEventListener('click', ()=>{
    const name = ($('#nameInput')?.value||'').trim();
    state.name = name || randomName();
    if(!state.org) state.org = Math.random()<.5?'경찰':'해양경찰';
    if(!state.gender) state.gender = Math.random()<.5?'남자':'여자';
    if(!state.rank) state.rank = '순경';

    // 첫 적 세팅
    state.enemy = spawnEnemy();
    // 화면 표시
    $('#panelGame').style.display='block';
    renderAll(); persist();

    showToast(`신원 확정: ${state.org} · ${state.gender} · ${state.rank} · ${state.name}`);
  });

  // 의원면직
  $('#btnQuit')?.addEventListener('click', ()=>{
    logHistory('의원면직');
    endGame('의원면직으로 게임을 종료했습니다.');
  });

  wireBattle();
}

function spawnEnemy(){
  const names=['소란범','절도범','폭행범','주취자','흉기소지자'];
  return { name:names[Math.floor(Math.random()*names.length)], hp: Math.floor(20+Math.random()*20) };
}

function wireBattle(){
  $('#btnRoll')?.addEventListener('click', ()=>turn('roll'));
  $('#btnBaton')?.addEventListener('click', ()=>turn('baton'));
  $('#btnFire')?.addEventListener('click', ()=>{ flash(); turn('fire'); });
  $('#btnSwap')?.addEventListener('click', ()=>{
    state.weapon = state.weapon?null:'9mm';
    showToast(`무기: ${state.weapon?state.weapon:'맨손'}`);
  });
  $('#btnMed')?.addEventListener('click', ()=>{
    if(state.kit<=0){ showToast('구급함 없음'); return; }
    state.kit--; heal(30);
    enemyAct(); // 내 턴 소요 → 적만 공격
    endTurnToast('구급함 사용으로 턴 소요');
    renderAll(); persist();
  });
  $('#btnClear')?.addEventListener('click', openAfter);
  $('#btnUseKit')?.addEventListener('click', ()=>{ state.kit++; showToast('구급함 +1'); });
  $('#btnWash')?.addEventListener('click', ()=>{
    state.hp = Math.min(state.hpMax, state.hp+10);
    monthAdvance(4); endTurnToast('애프터 진행(+4개월)');
    hideAfter(); nextEnemy();
  });
  $('#btnTryPromote')?.addEventListener('click', tryPromote);
}

function renderAll(){
  $('#titleInfo').textContent = `${state.name||'—'} — ${state.org||'—'}`;
  $('#tagRank').textContent = state.rank||'—';
  $('#tagHP').textContent   = `❤️ ${state.hp}/${state.hpMax}`;
  $('#tagMonth').textContent= `근속 ${state.month}개월`;
  $('#tagKit').textContent  = `구급함 ${state.kit}`;
  $('#enemyName').textContent = `⚔️ ${state.enemy?.name??'—'}`;
  $('#enemyHP').textContent   = `체력 ${state.enemy?.hp??'—'}`;
  $('#history').innerHTML = state.history.map(h=>`<li>${h}</li>`).join('');
  $('#btnClear').disabled = !(state.enemy && state.enemy.hp<=0);
}

// --- 턴 처리(요청 1: 턴마다 토스트, 삼단봉 데미지 토스트) ---
function turn(kind){
  if(state.ended) return;
  const sum = roll2();
  let dmg=0;
  if(kind==='roll'){ dmg = Math.max(0, sum-6); }
  else if(kind==='baton'){ dmg = 1; }      // 삼단봉 고정 1
  else if(kind==='fire'){ dmg = state.weapon ? 6 : 2; }

  if(dmg>0){
    state.enemy.hp -= dmg;
    if(kind==='baton') showToast(`삼단봉 데미지: ${dmg}`, 2000);
  }else{
    showToast('타격 실패', 2000);
  }

  if(state.enemy.hp<=0){
    $('#btnClear')?.removeAttribute('disabled');
    showToast('제압 완료! 애프터로 진행', 2000);
    renderAll(); persist();
    return;
  }

  enemyAct();
  endTurnToast(kind==='roll'?'주사위 턴 종료':'행동 턴 종료');
  renderAll(); persist();
}

function enemyAct(){
  const eroll=roll2(); const edmg=Math.max(0, eroll-7);
  if(edmg>0){
    state.hp = Math.max(0, state.hp-edmg);
    if(state.hp===0){ endGame('체력 0 — 게임오버'); }
  }
}
function endTurnToast(reason){ showToast(`턴 종료: ${reason}`, 2000); }

// --- 애프터 ---
function openAfter(){
  $('#panelAfter').style.display='block';
  monthAdvance(4); showToast('애프터 열림: +4개월', 2000);
  renderAll(); persist();
}
function hideAfter(){ $('#panelAfter').style.display='none'; }
function nextEnemy(){ state.enemy = spawnEnemy(); renderAll(); persist(); }

// --- 승진/강등 (요청 3: 강등 시 근속기간 초기화) ---
function tryPromote(){
  const years = Math.floor(state.month/12);
  if(years<1){ showModal('연차 부족: 만 1년차부터 가능'); return; }
  const need=7; showModal(`<div>주사위 2개 합 ${need}+ 이면 승진</div><div class="tiny">팝업은 3초 후 닫기 가능</div>`,'승진 도전');
  const sum = roll2();
  if(sum>=need) promote(); else logHistory(`승진 실패(주사위:${sum})`);
  renderAll(); persist();
}
function promote(){
  const idx = RANKS.indexOf(state.rank);
  if(idx<0||idx>=RANKS.length-1) return;
  const prev = state.rank;
  state.rank = RANKS[idx+1];
  logHistory(`승진: ${prev} → ${state.rank}`);
}
function demote(){
  const idx=RANKS.indexOf(state.rank);
  if(idx<=0) return;
  const prev=state.rank;
  state.rank=RANKS[idx-1];
  state.month=0;                 // 근속 0으로 리셋
  state.lastDemoteAt=Date.now(); // 강등 시점 기록(추후 로직 확장 대비)
  logHistory(`강등: ${prev} → ${state.rank} (근속 초기화)`);
}

// --- 엔딩/추모관 기록 ---
function endGame(msg){
  state.ended=true;
  $('#ending')?.replaceChildren(document.createTextNode(msg));
  const rec={ name:state.name, org:state.org, rank:state.rank, msg, at:Date.now() };
  const arr=JSON.parse(localStorage.getItem(MEM_KEY)||'[]'); arr.push(rec);
  localStorage.setItem(MEM_KEY, JSON.stringify(arr));
  showModal(msg,'엔딩'); renderAll(); persist();
}

// ---------- 추모관 (요청 4: 이미지 저장 오류 해결 - Canvas 저장) ----------
function bootMemorial(){
  const grid = $('#memGrid');
  const arr = JSON.parse(localStorage.getItem(MEM_KEY)||'[]').sort((a,b)=>b.at-a.at);
  grid.innerHTML='';
  arr.forEach((r,i)=>{
    const card=document.createElement('div'); card.className='card';
    const title=document.createElement('div'); title.innerHTML=`<b>${r.name}</b> — ${r.org} · ${r.rank}`;
    const memo=document.createElement('div'); memo.className='mut'; memo.textContent=r.msg;
    const time=document.createElement('div'); time.className='tiny'; time.textContent=new Date(r.at).toLocaleString();
    const row=document.createElement('div'); const dl=document.createElement('button'); dl.className='btn'; dl.textContent='이미지 저장';
    dl.addEventListener('click', ()=> exportCardAsImage(title.textContent, r, i));
    row.appendChild(dl); card.append(title,memo,time,row); grid.appendChild(card);
  });

  $('#btnExportAll')?.addEventListener('click', ()=>{
    arr.forEach((r,i)=> exportCardAsImage(`${r.name}_${i}`, r, i, true));
  });
}

function exportCardAsImage(fname, rec, idx, silent=false){
  const canvas=document.createElement('canvas'); const w=900,h=300;
  canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d');

  ctx.fillStyle='#0e172a'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#e9f0ff'; ctx.font='bold 28px system-ui,-apple-system,Segoe UI,Roboto,Arial';
  ctx.fillText('명예·추모관',28,48);
  ctx.font='700 22px system-ui,-apple-system,Segoe UI,Roboto,Arial';
  ctx.fillText(`${rec.name} — ${rec.org} · ${rec.rank}`,28,92);
  ctx.font='16px system-ui,-apple-system,Segoe UI,Roboto,Arial';
  wrapText(ctx,String(rec.msg||''),28,126,w-56,22);
  ctx.fillStyle='#9fb4d4';
  ctx.fillText(new Date(rec.at).toLocaleString(),28,h-26);

  canvas.toBlob((blob)=>{
    const a=document.createElement('a');
    a.download=`${sanitize(fname||rec.name)}.png`;
    a.href=URL.createObjectURL(blob);
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); if(!silent) showToast('이미지 저장 완료',2000); },120);
  },'image/png');
}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){
  const words=text.split(/\s+/); let line='';
  for(let i=0;i<words.length;i++){
    const test=line+words[i]+' ';
    if(ctx.measureText(test).width>maxWidth && i>0){ ctx.fillText(line,x,y); line=words[i]+' '; y+=lineHeight; }
    else line=test;
  }
  ctx.fillText(line,x,y);
}
function sanitize(s){ return String(s).replace(/[^\w가-힣._-]+/g,'_'); }
