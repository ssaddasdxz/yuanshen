/* ============================================================
   成就系统视图
   ============================================================ */
function readLS(key, def){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
  catch(e){ return def; }
}

function getStats(){
  const favs = readLS('teyvat-favorites', []);
  const saved = readLS('teyvat-saved-teams', []);
  const gachaHist = readLS('teyvat-gacha-history', []);
  const count5 = gachaHist.filter(r => r.stars === 5).length;
  return { favCount:favs.length, teamCount:saved.length, gachaTotal:gachaHist.length, gacha5:count5 };
}

function getViewedCount(){
  try {
    const v = JSON.parse(localStorage.getItem('teyvat-viewed-views') || '[]');
    return Array.isArray(v) ? v.length : 0;
  } catch(e){ return 0; }
}

function markViewed(view){
  let v;
  try { v = JSON.parse(localStorage.getItem('teyvat-viewed-views') || '[]'); } catch(e){ v = []; }
  if(!Array.isArray(v)) v = [];
  if(v.indexOf(view) < 0){
    v.push(view);
    localStorage.setItem('teyvat-viewed-views', JSON.stringify(v));
  }
}

const ACHIEVEMENTS = [
  { id:'fav1', icon:'fa-heart', tier:'bronze', name:'初见倾心', desc:'收藏 1 位角色', check:s=>s.favCount>=1, cur:s=>s.favCount, max:1, cat:'收藏' },
  { id:'fav2', icon:'fa-heart', tier:'silver', name:'收藏家', desc:'收藏 10 位角色', check:s=>s.favCount>=10, cur:s=>s.favCount, max:10, cat:'收藏' },
  { id:'fav3', icon:'fa-heart', tier:'gold', name:'角色图鉴大师', desc:'收藏 30 位角色', check:s=>s.favCount>=30, cur:s=>s.favCount, max:30, cat:'收藏' },
  { id:'team1', icon:'fa-edit', tier:'bronze', name:'初次配队', desc:'保存 1 套自定义配队', check:s=>s.teamCount>=1, cur:s=>s.teamCount, max:1, cat:'配队' },
  { id:'team2', icon:'fa-edit', tier:'silver', name:'战术大师', desc:'保存 5 套自定义配队', check:s=>s.teamCount>=5, cur:s=>s.teamCount, max:5, cat:'配队' },
  { id:'team3', icon:'fa-edit', tier:'gold', name:'阵容收藏家', desc:'保存 15 套自定义配队', check:s=>s.teamCount>=15, cur:s=>s.teamCount, max:15, cat:'配队' },
  { id:'gacha1', icon:'fa-dice', tier:'bronze', name:'初试身手', desc:'累计抽卡 10 次', check:s=>s.gachaTotal>=10, cur:s=>s.gachaTotal, max:10, cat:'抽卡' },
  { id:'gacha2', icon:'fa-dice', tier:'silver', name:'百抽达成', desc:'累计抽卡 100 次', check:s=>s.gachaTotal>=100, cur:s=>s.gachaTotal, max:100, cat:'抽卡' },
  { id:'gacha3', icon:'fa-dice', tier:'gold', name:'千抽之约', desc:'累计抽卡 1000 次', check:s=>s.gachaTotal>=1000, cur:s=>s.gachaTotal, max:1000, cat:'抽卡' },
  { id:'gacha4', icon:'fa-star', tier:'bronze', name:'初次出金', desc:'获得 1 个 5★ 角色', check:s=>s.gacha5>=1, cur:s=>s.gacha5, max:1, cat:'抽卡' },
  { id:'gacha5', icon:'fa-star', tier:'silver', name:'欧皇附体', desc:'获得 10 个 5★ 角色', check:s=>s.gacha5>=10, cur:s=>s.gacha5, max:10, cat:'抽卡' },
  { id:'gacha6', icon:'fa-star', tier:'gold', name:'金光闪闪', desc:'获得 30 个 5★ 角色', check:s=>s.gacha5>=30, cur:s=>s.gacha5, max:30, cat:'抽卡' },
  { id:'exp1', icon:'fa-compass', tier:'bronze', name:'提瓦特旅人', desc:'浏览 5 个不同功能页面', check:s=>s.viewedViews>=5, cur:s=>s.viewedViews, max:5, cat:'探索' },
  { id:'exp2', icon:'fa-compass', tier:'silver', name:'档案馆常客', desc:'浏览全部 12 个功能页面', check:s=>s.viewedViews>=12, cur:s=>s.viewedViews, max:12, cat:'探索' }
];

export function renderAchievements(){
  const sumEl = document.getElementById('achSummary');
  const gridEl = document.getElementById('achGrid');
  if(!sumEl || !gridEl) return;

  const s = getStats();
  s.viewedViews = getViewedCount();
  const done = ACHIEVEMENTS.filter(a => a.check(s)).length;
  const rate = Math.round(done / ACHIEVEMENTS.length * 100);

  sumEl.innerHTML =
    `<div class="ach-summary-card"><div class="ach-summary-icon"><i class="fas fa-medal"></i></div><div class="ach-summary-value">${done}/${ACHIEVEMENTS.length}</div><div class="ach-summary-label">已完成成就</div></div>` +
    `<div class="ach-summary-card"><div class="ach-summary-icon"><i class="fas fa-percent"></i></div><div class="ach-summary-value">${rate}%</div><div class="ach-summary-label">完成度</div></div>` +
    `<div class="ach-summary-card"><div class="ach-summary-icon"><i class="fas fa-heart"></i></div><div class="ach-summary-value">${s.favCount}</div><div class="ach-summary-label">收藏角色</div></div>` +
    `<div class="ach-summary-card"><div class="ach-summary-icon"><i class="fas fa-dice"></i></div><div class="ach-summary-value">${s.gachaTotal}</div><div class="ach-summary-label">累计抽数</div></div>` +
    `<div class="ach-summary-card"><div class="ach-summary-icon"><i class="fas fa-star"></i></div><div class="ach-summary-value">${s.gacha5}</div><div class="ach-summary-label">5★ 数量</div></div>`;

  const cats = {};
  ACHIEVEMENTS.forEach(a => { (cats[a.cat] = cats[a.cat] || []).push(a); });

  gridEl.innerHTML = Object.keys(cats).map(cat =>
    cats[cat].map(a => {
      const isDone = a.check(s);
      const cur = Math.min(a.cur(s), a.max);
      const pct = Math.min(100, Math.round(cur / a.max * 100));
      return `<div class="ach-card ${isDone?'done':''}">
        <div class="ach-icon"><i class="fas ${a.icon}"></i></div>
        <div class="ach-info">
          <div class="ach-name">${a.name} <span class="ach-tier ${a.tier}">${({bronze:'铜',silver:'银',gold:'金'})[a.tier]}</span></div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-progress"><div class="ach-progress-fill" style="width:${pct}%"></div></div>
          <div class="ach-progress-text"><span>${a.cat}</span><span class="cur">${cur} / ${a.max}</span></div>
        </div></div>`;
    }).join('')
  ).join('');
}

export function initAchievements(){
  document.querySelectorAll('.nav-item[data-view="achievements"]').forEach(el => {
    el.addEventListener('click', () => setTimeout(renderAchievements, 0));
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.dataset.view;
      if(v) markViewed(v);
    });
  });

  const favClearBtn = document.getElementById('favClearBtn');
  if(favClearBtn){
    favClearBtn.addEventListener('click', () => {
      if(confirm('确定要清空全部收藏吗？')){
        localStorage.setItem('teyvat-favorites', JSON.stringify([]));
        location.reload();
      }
    });
  }

  const h0 = window.location.hash.replace('#/','').split('/');
  if(h0[0] === 'achievements') setTimeout(renderAchievements, 50);
}