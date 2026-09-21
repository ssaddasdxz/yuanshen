/* ============================================================
   深渊推荐视图
   ============================================================ */
import { CHARACTERS, TEAMS, ELEMENTS, AVATAR_MAP } from '../data/full.js';

function charImg(c){
  const TA = window.TA;
  if(TA && TA.getCharCardMeta){
    const m = TA.getCharCardMeta(c);
    return m.cands[0] || m.placeholder;
  }
  const n = AVATAR_MAP[c.name];
  return n ? `https://enka.network/ui/UI_Gacha_AvatarImg_${n}.png` : makeFallback(c.name);
}

function makeFallback(name){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#333"/><text x="60" y="90" font-size="20" text-anchor="middle" fill="#fff">${name}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const ABYSS_FLOORS = [
  { floor:9, name:'第 9 层', diff:'基础', enemies:[
    { icon:'fa-dragon', name:'群怪环境·史莱姆群', desc:'大量元素史莱姆涌出，适合扩散/聚怪体系', tags:['对群','聚怪'] },
    { icon:'fa-shield-alt', name:'护盾愚人众', desc:'需要破盾或绕过护盾输出', tags:['破盾','高频'] }
  ]},
  { floor:10, name:'第 10 层', diff:'进阶', enemies:[
    { icon:'fa-fire', name:'火深渊法师', desc:'火元素护盾，需水/冰破盾', tags:['破盾','对群'], element:'pyro' },
    { icon:'fa-users', name:'愚人众群组', desc:'多愚人众精英怪聚集', tags:['对群','控场'] }
  ]},
  { floor:11, name:'第 11 层', diff:'挑战', enemies:[
    { icon:'fa-bolt', name:'雷音权现', desc:'高机动单体 Boss，需稳定输出', tags:['对单','持续'], element:'electro' },
    { icon:'fa-snowflake', name:'魔像群', desc:'遗迹魔像与小宝混合', tags:['对群','破盾'] }
  ]},
  { floor:12, name:'第 12 层', diff:'极限', enemies:[
    { icon:'fa-crown', name:'半兽人王/黄金王兽', desc:'高血量精英，对单爆发环境', tags:['对单','爆发'] },
    { icon:'fa-skull', name:'群怪多波次', desc:'多波次刷怪，对群循环要求高', tags:['对群','循环'] }
  ]}
];

const TAG_WEIGHTS = { '对单':2, '对群':2, '破盾':1.5, '聚怪':1.5, '爆发':1, '持续':1, '循环':1, '控场':1, '高频':1 };
const COUNTER = { hydro:'pyro', pyro:'cryo', cryo:'hydro', electro:'hydro' };

function matchTeams(enemy, count){
  const scored = TEAMS.map(t => {
    let score = 0;
    enemy.tags.forEach(tag => {
      if(t.tags.includes(tag)) score += TAG_WEIGHTS[tag] || 1;
    });
    if(enemy.element){
      const counterEl = Object.keys(COUNTER).find(k => COUNTER[k] === enemy.element);
      if(counterEl && t.members.some(m => m.element === counterEl)) score += 2;
    }
    return { team:t, score };
  }).sort((a,b) => b.score - a.score);

  const out = []; const used = new Set();
  for(const s of scored){
    if(out.length >= count) break;
    if(!used.has(s.team.id)){ out.push(s.team); used.add(s.team.id); }
  }
  if(out.length < count){
    TEAMS.filter(t => t.tier === 'T0' || t.tier === 'T1').forEach(t => {
      if(out.length >= count) return;
      if(!used.has(t.id)){ out.push(t); used.add(t.id); }
    });
  }
  return out;
}

let abyssFloor = 12;

export function renderAbyss(){
  const tabsEl = document.getElementById('abyssFloorTabs');
  const contentEl = document.getElementById('abyssContent');
  if(!tabsEl || !contentEl) return;

  tabsEl.innerHTML = ABYSS_FLOORS.map(f =>
    `<button class="abyss-floor-tab ${f.floor===abyssFloor?'active':''}" data-floor="${f.floor}">${f.name} · ${f.diff}</button>`
  ).join('');

  tabsEl.querySelectorAll('.abyss-floor-tab').forEach(b => {
    b.addEventListener('click', () => { abyssFloor = parseInt(b.dataset.floor); renderAbyss(); });
  });

  const floor = ABYSS_FLOORS.find(f => f.floor === abyssFloor);
  let html = '';
  floor.enemies.forEach(enemy => {
    const recs = matchTeams(enemy, 2);
    html += `<div class="abyss-enemy-card">
      <div class="abyss-enemy-icon"><i class="fas ${enemy.icon}"></i></div>
      <div class="abyss-enemy-info">
        <div class="abyss-enemy-name">${enemy.name}</div>
        <div class="abyss-enemy-desc">${enemy.desc}</div>
        <div class="abyss-enemy-tags">${enemy.tags.map(t=>`<span class="abyss-enemy-tag">${t}</span>`).join('')}</div>
      </div>
    </div>`;
    recs.forEach(team => {
      const members = team.members.map(m => {
        const c = CHARACTERS.find(x => x.name === m.name);
        const src = c ? charImg(c) : makeFallback(m.name);
        const ph = makeFallback(m.name);
        return `<div class="team-member" data-name="${m.name}">
          <div class="team-member-img"><img src="${src}" alt="${m.name}" onerror="this.src='${ph}'">
          <div class="team-member-role">${m.role}</div></div>
          <div class="team-member-name">${m.name}</div></div>`;
      }).join('');
      html += `<div class="abyss-team-rec">
        <div class="abyss-team-head">
          <div class="abyss-team-title"><i class="fas fa-crown"></i>${team.name} <span class="tier ${team.tier==='T0'?'t0':''}">${team.tier}</span></div>
          <div class="team-tags">${team.tags.slice(0,3).map(t=>`<span class="team-tag">${t}</span>`).join('')}</div>
        </div>
        <div class="abyss-team-why"><i class="fas fa-lightbulb" style="color:var(--gold-2);margin-right:6px;"></i>${team.reason}</div>
        <div class="team-members">${members}</div>
      </div>`;
    });
  });

  contentEl.innerHTML = html;

  contentEl.querySelectorAll('.team-member').forEach(el => {
    el.addEventListener('click', () => {
      const c = CHARACTERS.find(x => x.name === el.dataset.name);
      if(c && window.TA && window.TA.openCharacterDetail) window.TA.openCharacterDetail(c.id);
    });
  });
}

export function initAbyss(){
  document.querySelectorAll('.nav-item[data-view="abyss"]').forEach(el => {
    el.addEventListener('click', () => setTimeout(renderAbyss, 0));
  });
  const h0 = window.location.hash.replace('#/','').split('/');
  if(h0[0] === 'abyss') setTimeout(renderAbyss, 50);
}