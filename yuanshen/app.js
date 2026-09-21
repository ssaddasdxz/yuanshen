/* ============================================================
   提瓦特档案馆 · 应用逻辑 v5.1（ES Module 版）
   ============================================================ */

// ============================================================
// 导入
// ============================================================
import {
  ELEMENTS, ELEMENT_ORDER, WEAPON_ICONS,
  AVATAR_MAP, EN_NAMES,
  BREAK_MATERIALS, CHARACTERS, BUILDS, TEAMS,
  WEAPONS, ARTIFACTS, CHAR_TALENT_BOOK
} from './data/full.js';

import {
  TIER_LIST, TALENT_BOOKS, TALENT_COST,
  WEAPON_BREAK_MATS, ARTIFACT_DOMAINS, WEAPON_EPITOMIZED
} from './data/extra.js';

import { renderAbyss, initAbyss } from './views/abyss.js';
import { renderAchievements, initAchievements } from './views/achievements.js';

// ============================================================
// 命名空间
// ============================================================
const TA = window.TA = window.TA || {};

// ============================================================
// 图片缓存（IndexedDB + localStorage 镜像）
// ============================================================
const ImageCache = (function(){
  const DB_NAME = 'teyvat-cache';
  const STORE = 'images';
  const LS_KEY = 'teyvat-img-best';
  let db = null;
  let memBest = {};
  try { memBest = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e){ memBest = {}; }

  function open(){
    return new Promise(resolve => {
      if(db){ resolve(db); return; }
      try {
        if(!window.indexedDB){ resolve(null); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = () => resolve(null);
      } catch(e){ resolve(null); }
    });
  }

  function getBestSync(name){ return memBest[name] || null; }

  async function setBest(name, index){
    if(memBest[name] === index) return;
    memBest[name] = index;
    try { localStorage.setItem(LS_KEY, JSON.stringify(memBest)); } catch(e){}
    const d = await open();
    if(!d) return;
    try {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(index, name);
    } catch(e){}
  }

  return { getBestSync, setBest };
})();

// ============================================================
// 状态
// ============================================================
const GACHA_DEFAULT_STATE = {
  total:0, count5:0, count4:0, count3:0,
  pity5:0, pity4:0, guaranteed:false,
  epitomizedPath:null, fatePoints:0
};
const savedGachaState = JSON.parse(localStorage.getItem('teyvat-gacha-state') || '{}');

const STATE = {
  view:'dashboard',
  element:'all', weapon:'all', rarity:'all', region:'all',
  wType:'all', wStar:'all',
  search:'', sort:'default',
  compareList:[], highlightNames:[], currentCharId:null,
  theme: localStorage.getItem('teyvat-theme') || 'dark',
  lang: localStorage.getItem('teyvat-lang') || 'zh',
  imageFailed: new Set(),

  gacha: {
    activePool: savedGachaState.activePool || 'character',
    pools: {
      character: { ...GACHA_DEFAULT_STATE, ...(savedGachaState.pools?.character || {}) },
      weapon:    { ...GACHA_DEFAULT_STATE, ...(savedGachaState.pools?.weapon || {}) }
    },
    history: JSON.parse(localStorage.getItem('teyvat-gacha-history') || '[]')
  },

  calcSelected: new Set(),
  editorSlots: [null, null, null, null],
  savedTeams: JSON.parse(localStorage.getItem('teyvat-saved-teams') || '[]'),
  favorites: new Set(JSON.parse(localStorage.getItem('teyvat-favorites') || '[]')),
  achievements: JSON.parse(localStorage.getItem('teyvat-achievements') || '{}'),

  charCardMeta: {},
  weaponCatalogLoaded: false,
  weaponCatalog: WEAPONS.slice()
};

// ============================================================
// DOM 快捷
// ============================================================
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const dom = {
  main:$('#main'), charGrid:$('#charGrid'), charCount:$('#charCount'), charPageDesc:$('#charPageDesc'),
  teamGrid:$('#teamGrid'), teamCount:$('#teamCount'),
  weaponGrid:$('#weaponGrid'), weaponCount:$('#weaponCount'), weaponPageDesc:$('#weaponPageDesc'),
  artifactGrid:$('#artifactGrid'), artifactCount:$('#artifactCount'), artifactPageDesc:$('#artifactPageDesc'),
  compareWrap:$('#compareWrap'), compareCount:$('#compareCount'), compareBadge:$('#compareBadge'), compareDesc:$('#compareDesc'),
  searchInput:$('#globalSearch'), searchDropdown:$('#searchDropdown'),
  floatingBar:$('#floatingBar'), toastContainer:$('#toastContainer'),
  sidebar:$('#sidebar'), sidebarBackdrop:$('#sidebarBackdrop'),
  statsGrid:$('#statsGrid'), elementRing:$('#elementRing'), regionBars:$('#regionBars'),
  themeBtn:$('#themeBtn'), langBtn:$('#langBtn'),
  gachaResults:$('#gachaResults'),
  calcCharList:$('#calcCharList'), calcSummary:$('#calcSummary'),
  editorSlots:$('#editorSlots'), editorSaved:$('#editorSaved'), editorSavedList:$('#editorSavedList'),
  pickerOverlay:$('#pickerOverlay'), pickerGrid:$('#pickerGrid')
};

// ============================================================
// 工具函数
// ============================================================
function getDisplayName(name){
  return STATE.lang === 'en' && EN_NAMES[name] ? EN_NAMES[name] : name;
}

function getCharCardMeta(c){
  const key = c.name + '|' + STATE.lang;
  if(STATE.charCardMeta[key]) return STATE.charCardMeta[key];
  const cands = getImageCandidates(c.name);
  const meta = {
    cands,
    candsAttr: cands.map(u => encodeURIComponent(u)).join('|'),
    placeholder: makePlaceholder(c.name, c.element)
  };
  STATE.charCardMeta[key] = meta;
  return meta;
}

function getImageCandidates(name){
  const n = AVATAR_MAP[name];
  if(!n) return [];
  const characterSlugs = {
    '烟绯':'yanfei','嘉明':'gaming','托马':'thoma','绮良良':'kirara',
    '林尼':'lyney','琳妮特':'lynette','雷电将军':'raiden','神里绫华':'ayaka',
    '神里绫人':'ayato','鹿野院平藏':'shikanoin-heizou','珊瑚宫心海':'kokomi',
    '八重神子':'yae-miko','胡桃':'hu-tao','旅行者':'traveler-anemo'
  };
  const englishName = EN_NAMES[name] || n;
  const slug = characterSlugs[name] || englishName.toLowerCase().replace(/[']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const cands = [
    `https://enka.network/ui/UI_Gacha_AvatarImg_${n}.png`,
    `https://enka.network/ui/UI_AvatarIcon_${n}.png`,
    `https://genshin.jmp.blue/assets/UI_AvatarIcon_${n}.png`,
    `https://genshin.jmp.blue/characters/${slug}/icon`
  ];
  const best = ImageCache.getBestSync(name);
  if(typeof best === 'number' && best > 0 && best < cands.length){
    const [hit] = cands.splice(best, 1);
    cands.unshift(hit);
  }
  return cands;
}

const WEAPON_IMAGE_KEYS = {
  '护摩之杖':'Polearm_Homa','薙草之稻光':'Polearm_Grasscutter','赤月之形':'Polearm_RedMoon',
  '万世流涌大典':'Catalyst_Tulaytullahs_Remembrance','千夜浮梦':'Catalyst_AThousandFloatingDreams',
  '静水流涌之辉':'Sword_SplendorOfTranquilWaters','雾切之回光':'Sword_MistsplitterReforged',
  '若水':'Bow_AquaSimulacra','阿莫斯之弓':'Bow_Amos','苍古自由之誓':'Sword_FreedomSworn',
  '终末嗟叹之诗':'Bow_ElegyForTheEnd','和璞鸢':'Polearm_PrimordialJadeWingedSpear',
  '四风原典':'Catalyst_LostPrayer','天空之翼':'Bow_SkywardHarp','狼的末路':'Claymore_WolfishGravestone',
  '天空之傲':'Claymore_SkywardPride','风鹰剑':'Sword_AquilaFavonia','天空之刃':'Sword_SkywardBlade',
  '渔获':'Polearm_TheCatch','决斗之枪':'Polearm_Deathmatch','试作澹月':'Bow_PrototypeCrescent',
  '破魔之弓':'Bow_Hamayumi','西风猎弓':'Bow_FavoniusWarbow','黑岩长剑':'Sword_BlackcliffLongsword',
  '天目影打刀':'Sword_AmenomaKageuchi','铁蜂刺':'Sword_IronSting','腐殖之剑':'Sword_FesteringDesire',
  '遗祀玉珑':'Catalyst_BalladOfTheBoundlessBlue','流浪乐章':'Catalyst_TheWidsith','流浪的晚星':'Catalyst_WanderingEvenstar',
  '魔导绪论':'Catalyst_ThrillingTalesOfDragonSlayers','螭骨剑':'Claymore_SerpentSpine','祭礼大剑':'Claymore_SacrificialGreatsword',
  '西风大剑':'Claymore_FavoniusGreatsword','雨裁':'Claymore_Rainslasher','祭礼剑':'Sword_SacrificialSword',
  '祭礼弓':'Bow_SacrificialBow','祭礼残章':'Catalyst_SacrificialFragments','西风剑':'Sword_FavoniusSword',
  '西风长枪':'Polearm_FavoniusLance','西风秘典':'Catalyst_FavoniusCodex','弓藏':'Bow_Rust',
  '笛剑':'Sword_TheFlute','匣里灭辰':'Polearm_DragonBane','匣里日月':'Catalyst_SolarPearl',
  '千岩长枪':'Polearm_LithicSpear','暗巷闪光':'Sword_TheAlleyFlash','西福斯的月光':'Sword_XiphosMoonlight'
};

function getWeaponImageCandidates(weapon){
  const key = WEAPON_IMAGE_KEYS[weapon.name];
  const slug = weapon.slug;
  const cands = [];
  if(slug) cands.push(`https://genshin.jmp.blue/weapons/${slug}/icon`);
  if(key) cands.push(`https://enka.network/ui/UI_EquipIcon_${key}.png`);
  const best = ImageCache.getBestSync('weapon:' + weapon.name);
  if(typeof best === 'number' && best > 0 && best < cands.length){
    const [hit] = cands.splice(best, 1);
    cands.unshift(hit);
  }
  return cands;
}

function makePlaceholder(name, element){
  const c = ELEMENTS[element] || ELEMENTS.anemo;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c.from}"/><stop offset="100%" stop-color="${c.to}"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><circle cx="150" cy="160" r="80" fill="none" stroke="${c.text}" stroke-opacity="0.25" stroke-width="2"/><text x="150" y="185" font-size="80" text-anchor="middle" fill="${c.text}" fill-opacity="0.9" font-family="Arial">✦</text><text x="150" y="300" font-size="28" font-weight="bold" text-anchor="middle" fill="#fff" fill-opacity="0.95" font-family="sans-serif">${name}</text><text x="150" y="340" font-size="14" text-anchor="middle" fill="${c.text}" fill-opacity="0.8" font-family="sans-serif">${c.name}元素</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function makeWeaponPlaceholder(weapon){
  const colors = weapon.stars === 5 ? ['#6c4a1c','#f6d77a'] : weapon.stars === 4 ? ['#382b59','#c7a7ff'] : ['#27313b','#a9b4bf'];
  const icon = weapon.type === '弓' ? '⌁' : weapon.type === '法器' ? '✦' : weapon.type === '长枪' ? '†' : weapon.type === '双手剑' ? '⚔' : '➶';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="400" height="240" fill="url(#g)"/><circle cx="200" cy="98" r="74" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/><text x="200" y="125" text-anchor="middle" font-size="76" fill="#fff" fill-opacity=".9" font-family="serif">${icon}</text><text x="200" y="182" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="sans-serif">${weapon.name}</text><text x="200" y="210" text-anchor="middle" font-size="13" fill="#fff" fill-opacity=".75" font-family="sans-serif">${'★'.repeat(weapon.stars)} · ${weapon.type}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function getWeaponIcon(w){ return WEAPON_ICONS[w] || 'fa-book'; }
function getCharacterRoleHint(c){
  if(c.weapon === '双手剑') return '前排输出';
  if(c.weapon === '长枪') return '辅助守护';
  if(c.weapon === '单手剑') return '近战输出';
  if(c.weapon === '弓') return '远程输出';
  if(c.weapon === '法器') return '法术输出';
  return '综合定位';
}
function getCharacterTeamCount(c){
  return TEAMS.filter(team => team.members.some(m => m.name === c.name)).length;
}
function debounce(fn, wait){
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), wait); };
}
function toast(msg, icon = 'fa-check'){
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  dom.toastContainer.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 300); }, 2200);
}

function safeRender(fn, view){
  try { fn(); }
  catch(err){
    console.error(`[${view}] render failed`, err);
    const el = $(`#view-${view}`);
    if(el) el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>页面渲染失败</h3><p>${err.message}</p></div>`;
  }
}

// ============================================================
// 图片加载
// ============================================================
TA.tryNextSource = async function(img){
  const name = img.getAttribute('alt');
  const enc = img.getAttribute('data-candidates');
  const isWeapon = img.hasAttribute('data-weapon');
  if(!enc){
    const fallback = img.getAttribute('data-fallback');
    if(fallback){ img.src = fallback; img.style.display=''; img.classList.add('loaded'); }
    else img.style.display = 'none';
    return;
  }
  const arr = enc.split('|').map(s => decodeURIComponent(s));
  let idx = parseInt(img.getAttribute('data-candidate-index') || '0', 10) + 1;

  if(idx < arr.length){
    img.setAttribute('data-candidate-index', idx);
    img.src = arr[idx];
  } else {
    if(name && !STATE.imageFailed.has(name)){
      STATE.imageFailed.add(name);
      const cached = ImageCache.getBestSync(isWeapon ? 'weapon:' + name : name);
      if(typeof cached === 'number' && cached < arr.length){
        img.src = arr[cached];
        img.style.display='';
        img.classList.add('loaded');
        return;
      }
    }
    const fallback = img.getAttribute('data-fallback');
    if(fallback){ img.src = fallback; img.style.display=''; img.classList.add('loaded'); }
    else img.style.display = 'none';
  }
};

TA.onImgLoad = function(img){
  img.classList.add('loaded');
  const name = img.getAttribute('alt');
  if(!name) return;
  const idx = parseInt(img.getAttribute('data-candidate-index') || '0', 10);
  if(img.src.startsWith('http')){
    const key = img.hasAttribute('data-weapon') ? 'weapon:' + name : name;
    ImageCache.setBest(key, idx);
  }
};

window.__tryNextSource = TA.tryNextSource;
window.__onImgLoad = TA.onImgLoad;

// ============================================================
// 武器目录
// ============================================================
const WEAPON_SLUGS = {
  '护摩之杖':'staff-of-homa','薙草之稻光':'engulfing-lightning','赤月之形':'crimson-moon-s-semblance',
  '万世流涌大典':'tulaytullah-s-remembrance','千夜浮梦':'a-thousand-floating-dreams','静水流涌之辉':'splendor-of-tranquil-waters',
  '雾切之回光':'mistsplitter-reforged','若水':'aqua-simulacra','阿莫斯之弓':'amos-bow','苍古自由之誓':'freedom-sworn',
  '终末嗟叹之诗':'elegy-for-the-end','和璞鸢':'primordial-jade-winged-spear','四风原典':'lost-prayer-to-the-sacred-winds',
  '天空之翼':'skyward-harp','狼的末路':'wolf-s-gravestone','天空之傲':'skyward-pride','风鹰剑':'aquila-favonia','天空之刃':'skyward-blade',
  '渔获':'the-catch','决斗之枪':'deathmatch','黑缨枪':'black-tassel','白缨枪':'white-tassel','试作澹月':'prototype-crescent',
  '破魔之弓':'hamayumi','西风猎弓':'favonius-warbow','黑岩长剑':'blackcliff-longsword','天目影打刀':'amenoma-kageuchi',
  '铁蜂刺':'iron-sting','腐殖之剑':'festering-desire','遗祀玉珑':'sacrificial-jade','流浪乐章':'the-widsith',
  '流浪的晚星':'wandering-evenstar','魔导绪论':'thrilling-tales-of-dragon-slayers','螭骨剑':'serpent-spine',
  '祭礼大剑':'sacrificial-greatsword','西风大剑':'favonius-greatsword','雨裁':'rainslasher','祭礼剑':'sacrificial-sword',
  '祭礼弓':'sacrificial-bow','祭礼残章':'sacrificial-fragments','西风剑':'favonius-sword','西风长枪':'favonius-lance',
  '西风秘典':'favonius-codex','弓藏':'rust','笛剑':'the-flute','匣里灭辰':'dragon-s-bane','匣里日月':'solar-pearl',
  '千岩长枪':'lithic-spear','暗巷闪光':'the-alley-flash','西福斯的月光':'xiphos-moonlight'
};

const WEAPON_DETAIL_LS_KEY = 'teyvat-weapon-details-v1';

function loadWeaponDetailCache(){
  try { return JSON.parse(localStorage.getItem(WEAPON_DETAIL_LS_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveWeaponDetailCache(cache){
  try { localStorage.setItem(WEAPON_DETAIL_LS_KEY, JSON.stringify(cache)); } catch(e){}
}

async function pooledFetch(urls, concurrency = 4){
  const results = new Array(urls.length);
  let cursor = 0;
  async function worker(){
    while(cursor < urls.length){
      const i = cursor++;
      try {
        const r = await fetch(urls[i]);
        results[i] = r.ok ? await r.json() : null;
      } catch(e){ results[i] = null; }
    }
  }
  await Promise.all(Array(Math.min(concurrency, urls.length)).fill(0).map(worker));
  return results;
}

async function loadWeaponCatalog(){
  if(STATE.weaponCatalogLoaded) return;
  STATE.weaponCatalogLoaded = true;
  const detailCache = loadWeaponDetailCache();

  try {
    const response = await fetch('https://genshin.jmp.blue/weapons');
    if(!response.ok) throw new Error(`weapon catalog ${response.status}`);
    const slugs = await response.json();
    const localBySlug = new Map(WEAPONS.map(w => [WEAPON_SLUGS[w.name], w]));

    STATE.weaponCatalog = slugs.map(slug => {
      const local = localBySlug.get(slug);
      const cached = detailCache[slug];
      return {
        ...(local || {}),
        id: local?.id || `remote-${slug}`,
        slug,
        name: local?.name || cached?.name || '未命名武器',
        type: local?.type || cached?.type || '其他',
        stars: local?.stars || cached?.stars || 3,
        base: local?.base || cached?.base || '-',
        sub: local?.sub || cached?.sub || '-',
        passive: local?.passive || cached?.passive || '详情加载中'
      };
    });

    if(STATE.view === 'weapons') safeRender(renderWeapons, 'weapons');
    if(STATE.view === 'dashboard') safeRender(renderDashboard, 'dashboard');

    const missing = slugs.filter(s => !detailCache[s]);
    if(missing.length){
      const typeMap = { Sword:'单手剑', Claymore:'双手剑', Polearm:'长枪', Bow:'弓', Catalyst:'法器' };
      const details = await pooledFetch(missing.map(s => `https://genshin.jmp.blue/weapons/${s}`), 4);
      details.forEach((detail, i) => {
        const slug = missing[i];
        if(!detail) return;
        detailCache[slug] = {
          name: detail.name,
          type: typeMap[detail.type] || '其他',
          stars: detail.rarity || 3,
          base: detail.baseAttack || '-',
          sub: detail.subStat || '-',
          passive: '武器特效详情请在游戏内查看'
        };
      });
      saveWeaponDetailCache(detailCache);
      STATE.weaponCatalog.forEach(w => {
        const c = detailCache[w.slug];
        if(!c) return;
        if(w.type === '其他') w.type = c.type;
        if(w.base === '-') w.base = c.base;
        if(w.sub === '-') w.sub = c.sub;
        if(w.passive === '详情加载中') w.passive = c.passive;
      });
      if(STATE.view === 'weapons') safeRender(renderWeapons, 'weapons');
    }
  } catch(e){
    console.warn('武器目录同步失败，使用本地数据', e);
    STATE.weaponCatalog = WEAPONS.slice();
  }
}

// ============================================================
// 路由
// ============================================================
function setView(view, opts = {}){
  STATE.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));

  const renderers = {
    dashboard: renderDashboard,
    characters: renderCharacters,
    teams: renderTeams,
    weapons: renderWeapons,
    artifacts: renderArtifacts,
    gacha: renderGacha,
    calculator: renderCalculator,
    editor: renderEditor,
    compare: renderCompare,
    favorites: renderFavorites,
    abyss: renderAbyss,
    achievements: renderAchievements,
    tierlist: renderTierList,
    calendar: renderCalendar,
    talent: renderTalentCalc
  };
  const fn = renderers[view];
  if(fn) safeRender(fn, view);

  if(!opts.silent) window.scrollTo({ top:0, behavior:'smooth' });
  if(view === 'detail' && STATE.currentCharId) history.replaceState(null,'',`#/character/${STATE.currentCharId}`);
  else history.replaceState(null,'',`#/${view}`);
  updateFloatingBar();
}
TA.goView = setView;
window.__goView = setView;

// ============================================================
// 仪表盘
// ============================================================
function renderDashboard(){
  const total = CHARACTERS.length;
  const r5 = CHARACTERS.filter(c => c.rarity === 5).length;
  const r4 = total - r5;
  const regions = {};
  CHARACTERS.forEach(c => { regions[c.region] = (regions[c.region] || 0) + 1; });
  const regionKeys = Object.keys(regions).sort((a,b) => regions[b] - regions[a]);

  dom.statsGrid.innerHTML = `
    <div class="stat-card"><div class="stat-label"><i class="fas fa-users"></i> 角色总数</div><div class="stat-value">${total}<small>位</small></div><div class="stat-sub">涵盖 ${regionKeys.length} 个地区</div></div>
    <div class="stat-card"><div class="stat-label"><i class="fas fa-star"></i> 五星 / 四星</div><div class="stat-value">${r5}<small>/ ${r4}</small></div><div class="stat-sub">五星占比 ${(r5/total*100).toFixed(1)}%</div></div>
    <div class="stat-card"><div class="stat-label"><i class="fas fa-crown"></i> 顶级阵容</div><div class="stat-value">${TEAMS.length}<small>套</small></div><div class="stat-sub">T0 ${TEAMS.filter(t=>t.tier==='T0').length} 套 · T1 ${TEAMS.filter(t=>t.tier==='T1').length} 套</div></div>
    <div class="stat-card"><div class="stat-label"><i class="fas fa-sword"></i> 武器数量</div><div class="stat-value">${STATE.weaponCatalog.length}<small>把</small></div><div class="stat-sub">5★ ${STATE.weaponCatalog.filter(w=>w.stars===5).length} 把</div></div>
  `;

  const elemCount = {};
  CHARACTERS.forEach(c => { elemCount[c.element] = (elemCount[c.element]||0)+1; });
  dom.elementRing.innerHTML = ELEMENT_ORDER.map(el => {
    const e = ELEMENTS[el];
    return `<div class="el-pill" style="color:${e.color};" data-el="${el}"><i class="fas ${e.icon}"></i><span>${e.name}</span><span class="count">${elemCount[el]||0}</span></div>`;
  }).join('');

  dom.elementRing.querySelectorAll('.el-pill').forEach(el => {
    el.addEventListener('click', () => {
      STATE.element = el.dataset.el;
      updateElementChips();
      setView('characters');
    });
  });

  const maxR = Math.max(...regionKeys.map(r => regions[r]));
  dom.regionBars.innerHTML = regionKeys.map(r => `
    <div class="region-bar-item">
      <div class="name">${r}</div>
      <div class="region-bar-track"><div class="region-bar-fill" style="width:${(regions[r]/maxR*100).toFixed(0)}%"></div></div>
      <div class="count">${regions[r]}</div>
    </div>
  `).join('');

  dom.charCount.textContent = total;
  dom.teamCount.textContent = TEAMS.length;
  dom.weaponCount.textContent = STATE.weaponCatalog.length;
  dom.artifactCount.textContent = ARTIFACTS.length;
  dom.compareCount.textContent = STATE.compareList.length;
}

// ============================================================
// 角色图鉴
// ============================================================
function filterCharacters(){
  return CHARACTERS.filter(c => {
    if(STATE.element !== 'all' && c.element !== STATE.element) return false;
    if(STATE.weapon !== 'all' && c.weapon !== STATE.weapon) return false;
    if(STATE.rarity !== 'all' && c.rarity !== parseInt(STATE.rarity)) return false;
    if(STATE.region !== 'all' && c.region !== STATE.region) return false;
    if(STATE.search.trim()){
      const k = STATE.search.trim().toLowerCase();
      const dn = getDisplayName(c.name).toLowerCase();
      if(!c.name.toLowerCase().includes(k) && !dn.includes(k) &&
         !c.desc.toLowerCase().includes(k) && !c.weapon.toLowerCase().includes(k) &&
         !(c.region && c.region.toLowerCase().includes(k)) &&
         !ELEMENTS[c.element].name.includes(k)) return false;
    }
    return true;
  });
}

function sortCharacters(arr){
  const s = [...arr];
  switch(STATE.sort){
    case 'rarity-desc': s.sort((a,b)=>b.rarity-a.rarity||a.id-b.id); break;
    case 'rarity-asc':  s.sort((a,b)=>a.rarity-b.rarity||a.id-b.id); break;
    case 'name':        s.sort((a,b)=>getDisplayName(a.name).localeCompare(getDisplayName(b.name), STATE.lang==='en'?'en':'zh')); break;
    case 'element':     s.sort((a,b)=>ELEMENT_ORDER.indexOf(a.element)-ELEMENT_ORDER.indexOf(b.element)||a.id-b.id); break;
    case 'region':      s.sort((a,b)=>(a.region||'').localeCompare(b.region||'','zh')||a.id-b.id); break;
    default:            s.sort((a,b)=>a.id-b.id);
  }
  return s;
}

function renderCharacters(){
  const filtered = sortCharacters(filterCharacters());
  dom.charPageDesc.textContent = `共 ${filtered.length} 位角色`;
  dom.charCount.textContent = CHARACTERS.length;

  dom.compareBadge.textContent = STATE.compareList.length;
  dom.compareBadge.style.display = STATE.compareList.length > 0 ? 'grid' : 'none';
  dom.compareCount.textContent = STATE.compareList.length;

  const summaryEl = document.getElementById('charFilterSummary');
  if(summaryEl){
    const items = [];
    if(STATE.element !== 'all') items.push(ELEMENTS[STATE.element]?.name || STATE.element);
    if(STATE.weapon !== 'all') items.push(STATE.weapon);
    if(STATE.rarity !== 'all') items.push(`${STATE.rarity}★`);
    if(STATE.region !== 'all') items.push(STATE.region);
    if(STATE.search.trim()) items.push(`搜索：${STATE.search.trim()}`);
    const text = items.length ? items : ['全部角色'];
    summaryEl.innerHTML = `
      <span class="filter-summary-label">当前筛选</span>
      ${text.map((t,i)=>`<span class="filter-summary-pill ${i===0?'active':''}">${t}</span>`).join('')}
    `;
  }

  if(filtered.length === 0){
    dom.charGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><h3>没有找到匹配的角色</h3><p>试试调整筛选条件或搜索关键词</p></div>`;
    return;
  }

  const isHL = STATE.highlightNames.length > 0;
  const frag = document.createDocumentFragment();
  filtered.forEach(c => {
    const e = ELEMENTS[c.element];
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    const stars = Array(c.rarity).fill('<i class="fas fa-star"></i>').join('');
    const isCompared = STATE.compareList.includes(c.name);
    const isFav = STATE.favorites.has(c.name);
    const roleHint = getCharacterRoleHint(c);
    const teamCount = getCharacterTeamCount(c);

    let cls = 'char-card';
    if(isHL) cls += STATE.highlightNames.includes(c.name) ? ' highlighted' : ' dimmed';
    if(isCompared) cls += ' compared';
    if(isFav) cls += ' is-fav';

    const div = document.createElement('div');
    div.className = cls;
    div.dataset.id = c.id;
    div.dataset.name = c.name;
    div.innerHTML = `
      <div class="char-img">
        <div class="skeleton"></div>
        <img src="${src}" alt="${c.name}" loading="lazy" data-candidates="${meta.candsAttr}" data-candidate-index="0" data-fallback="${meta.placeholder}" onload="window.__onImgLoad(this)" onerror="window.__tryNextSource(this)">
        <div class="char-card-badges">
          <span class="char-badge rarity">${c.rarity}★</span>
          <span class="char-badge element" style="color:${e.color};border-color:${e.color}55;">${e.name}</span>
        </div>
        <div class="char-rarity">${stars}</div>
        <button class="compare-btn" data-compare="${c.name}" title="加入对比"><i class="fas ${isCompared?'fa-check':'fa-plus'}"></i></button>
        <button class="fav-btn ${isFav?'active':''}" data-fav="${c.name}" title="收藏"><i class="fas fa-heart"></i></button>
        <div class="char-element" style="color:${e.color};"><i class="fas ${e.icon}"></i></div>
      </div>
      <div class="char-info">
        <div class="char-name">${getDisplayName(c.name)}</div>
        <div class="char-meta-row">
          <span class="char-quick-tag"><i class="fas ${getWeaponIcon(c.weapon)}"></i>${c.weapon}</span>
          <span class="char-quick-tag"><i class="fas fa-map-pin"></i>${c.region}</span>
        </div>
        <div class="char-meta-row">
          <span class="char-quick-tag"><i class="fas fa-user-tag"></i>${roleHint}</span>
          <span class="char-quick-tag"><i class="fas fa-crown"></i>${teamCount}队</span>
        </div>
      </div>`;
    frag.appendChild(div);
  });
  dom.charGrid.innerHTML = '';
  dom.charGrid.appendChild(frag);
}

// ============================================================
// 角色详情
// ============================================================
function openCharacterDetail(charId){
  const c = CHARACTERS.find(x => x.id === charId);
  if(!c) return;
  STATE.currentCharId = charId;

  const e = ELEMENTS[c.element];
  const meta = getCharCardMeta(c);
  const src = meta.cands[0] || meta.placeholder;
  const stars = Array(c.rarity).fill('<i class="fas fa-star"></i>').join('');
  const build = BUILDS[c.name];
  const bm = BREAK_MATERIALS[c.element];
  const talents = c.talents || [];
  const constellations = c.constellations || [];
  const isFav = STATE.favorites.has(c.name);
  const roleHint = getCharacterRoleHint(c);
  const teamCount = getCharacterTeamCount(c);
  const relatedByElement = CHARACTERS.filter(x => x.element === c.element && x.name !== c.name).slice(0,4);
  const relatedByWeapon = CHARACTERS.filter(x => x.weapon === c.weapon && x.name !== c.name).slice(0,4);

  $('#view-detail').innerHTML = `
    <div class="breadcrumb"><span data-nav="characters">角色图鉴</span><i class="fas fa-chevron-right"></i><span>${getDisplayName(c.name)}</span></div>
    <div class="detail-page">
      <div class="detail-hero">
        <div class="detail-portrait">
          <img src="${src}" alt="${c.name}" data-candidates="${meta.candsAttr}" data-candidate-index="0" onload="window.__onImgLoad(this)" onerror="window.__tryNextSource(this)">
          <div class="detail-portrait-info">
            <div class="detail-name">${getDisplayName(c.name)}</div>
            <div class="detail-stars">${stars}</div>
          </div>
        </div>
        <div style="padding:12px;display:flex;gap:8px;">
          <button class="btn ${isFav?'btn-primary':''}" id="detailFavBtn" style="flex:1;"><i class="fas fa-heart"></i> ${isFav?'已收藏':'收藏'}</button>
          <button class="btn" id="detailCompareBtn" style="flex:1;"><i class="fas fa-balance-scale"></i> 对比</button>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-circle-info"></i> 基础信息</div>
          <div class="meta-grid">
            <div class="meta-item"><i class="fas ${e.icon}"></i><div><div class="meta-label">元素</div><div class="meta-value" style="color:${e.color};">${e.name}</div></div></div>
            <div class="meta-item"><i class="fas ${getWeaponIcon(c.weapon)}"></i><div><div class="meta-label">武器</div><div class="meta-value">${c.weapon}</div></div></div>
            <div class="meta-item"><i class="fas fa-map-pin"></i><div><div class="meta-label">地区</div><div class="meta-value">${c.region}</div></div></div>
            <div class="meta-item"><i class="fas fa-star"></i><div><div class="meta-label">稀有度</div><div class="meta-value">${c.rarity} 星</div></div></div>
          </div>
          <div class="detail-desc" style="margin-top:16px;"><i class="fas fa-quote-left" style="color:var(--gold-2);margin-right:8px;"></i>${c.desc}</div>
        </div>
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-tags"></i> 角色定位</div>
          <div class="role-badges">
            <span class="meta-pill"><i class="fas fa-user-tag"></i> ${roleHint}</span>
            <span class="meta-pill"><i class="fas fa-crown"></i> ${teamCount} 个主力队伍</span>
            <span class="meta-pill"><i class="fas fa-star"></i> ${c.rarity} 星角色</span>
          </div>
          <div class="mini-card-grid">
            <div class="mini-card-group">
              <div class="mini-card-title"><i class="fas fa-leaf"></i> 同元素</div>
              <div class="mini-card-list">
                ${relatedByElement.map(r => {
                  const m = getCharCardMeta(r);
                  return `<button class="mini-char" data-char-id="${r.id}"><img src="${m.cands[0]||m.placeholder}" alt="${r.name}" onerror="this.src='${m.placeholder}'"> <span>${getDisplayName(r.name)}</span></button>`;
                }).join('') || '<div class="mini-empty">暂无同元素角色</div>'}
              </div>
            </div>
            <div class="mini-card-group">
              <div class="mini-card-title"><i class="fas fa-sword"></i> 同武器</div>
              <div class="mini-card-list">
                ${relatedByWeapon.map(r => {
                  const m = getCharCardMeta(r);
                  return `<button class="mini-char" data-char-id="${r.id}"><img src="${m.cands[0]||m.placeholder}" alt="${r.name}" onerror="this.src='${m.placeholder}'"> <span>${getDisplayName(r.name)}</span></button>`;
                }).join('') || '<div class="mini-empty">暂无同武器角色</div>'}
              </div>
            </div>
          </div>
        </div>
        ${talents.length ? `
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-magic"></i> 天赋</div>
          <div class="talent-list">
            ${talents.map(t => `
              <div class="talent-item">
                <div class="talent-icon"><i class="fas fa-star"></i></div>
                <div class="talent-info">
                  <div class="talent-name">${t.n} <span class="talent-type">${t.t}</span></div>
                  <div class="talent-desc">${t.d}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}
        ${constellations.length ? `
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-diamond"></i> 命之座</div>
          <div class="constellation-grid">
            ${constellations.map((name,i)=>`
              <div class="const-item"><div class="const-num">C${i+1}</div><div class="const-name">${name}</div></div>
            `).join('')}
          </div>
        </div>` : ''}
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-box-open"></i> 突破材料</div>
          <div class="material-list">
            <div class="material-item"><div class="material-icon"><i class="fas fa-coins"></i></div><div class="material-name">摩拉</div><div class="material-count">×2,092,000</div></div>
            <div class="material-item"><div class="material-icon"><i class="fas fa-gem"></i></div><div class="material-name">${bm.gem}</div><div class="material-count">×1/9/9/6</div></div>
            <div class="material-item"><div class="material-icon"><i class="fas fa-leaf"></i></div><div class="material-name">${bm.local}</div><div class="material-count">×168</div></div>
            <div class="material-item"><div class="material-icon"><i class="fas fa-dragon"></i></div><div class="material-name">${bm.boss}</div><div class="material-count">×46</div></div>
            <div class="material-item"><div class="material-icon"><i class="fas fa-flask"></i></div><div class="material-name">${bm.common}</div><div class="material-count">×18/30/36</div></div>
          </div>
        </div>
        ${build ? `
        <div class="detail-section">
          <div class="detail-section-title"><i class="fas fa-tools"></i> 配装推荐</div>
          <div class="build-tabs">
            <div class="build-tab active" data-tab="weapons">武器</div>
            <div class="build-tab" data-tab="artifacts">圣遗物</div>
            <div class="build-tab" data-tab="stats">词条</div>
          </div>
          <div class="build-content active" data-content="weapons">
            ${build.weapons.map(w => `<div class="build-row"><div class="label">${w.stars}★</div><div class="value">${w.name} <span class="build-stars">${'★'.repeat(w.stars)}</span></div><div style="margin-left:auto;font-size:11px;color:var(--text-3);">${w.note}</div></div>`).join('')}
          </div>
          <div class="build-content" data-content="artifacts">
            ${build.artifacts.map(a => `<div class="build-row"><div class="label">套装</div><div class="value">${a.name}</div><div style="margin-left:auto;font-size:11px;color:var(--text-3);">${a.note}</div></div>`).join('')}
          </div>
          <div class="build-content" data-content="stats">
            <div class="build-row"><div class="label">时之沙</div><div class="value">${build.stats.sands}</div></div>
            <div class="build-row"><div class="label">空之杯</div><div class="value">${build.stats.goblet}</div></div>
            <div class="build-row"><div class="label">理之冠</div><div class="value">${build.stats.circlet}</div></div>
          </div>
        </div>` : ''}
      </div>
    </div>
  `;

  $$('#view-detail .build-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#view-detail .build-tab').forEach(t => t.classList.remove('active'));
      $$('#view-detail .build-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = $(`#view-detail .build-content[data-content="${tab.dataset.tab}"]`);
      if(content) content.classList.add('active');
    });
  });

  $$('#view-detail .mini-char').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.charId, 10);
      if(id) openCharacterDetail(id);
    });
  });

  $('#detailFavBtn').addEventListener('click', () => toggleFavorite(c.name));
  $('#detailCompareBtn').addEventListener('click', () => toggleCompare(c.name));

  $$('#view-detail [data-nav]').forEach(el => {
    el.addEventListener('click', () => setView(el.dataset.nav));
  });

  setView('detail');
}

function toggleFavorite(name){
  if(STATE.favorites.has(name)) STATE.favorites.delete(name);
  else STATE.favorites.add(name);
  localStorage.setItem('teyvat-favorites', JSON.stringify([...STATE.favorites]));
  if(STATE.view === 'detail') openCharacterDetail(STATE.currentCharId);
  else renderCharacters();
  toast(STATE.favorites.has(name) ? '已收藏' : '已取消收藏', 'fa-heart');
}

function toggleCompare(name){
  const idx = STATE.compareList.indexOf(name);
  if(idx > -1) STATE.compareList.splice(idx, 1);
  else {
    if(STATE.compareList.length >= 4){ toast('最多对比 4 位角色', 'fa-exclamation-circle'); return; }
    STATE.compareList.push(name);
  }
  if(STATE.view === 'characters') renderCharacters();
  if(STATE.view === 'detail') openCharacterDetail(STATE.currentCharId);
  updateFloatingBar();
  dom.compareBadge.textContent = STATE.compareList.length;
  dom.compareBadge.style.display = STATE.compareList.length > 0 ? 'grid' : 'none';
}

// ============================================================
// 阵容
// ============================================================
function renderTeams(){
  dom.teamCount.textContent = TEAMS.length;
  dom.teamGrid.innerHTML = TEAMS.map(team => {
    const members = team.members.map(m => {
      const c = CHARACTERS.find(x => x.name === m.name);
      const meta = c ? getCharCardMeta(c) : { cands:[], placeholder: makePlaceholder(m.name, m.element), candsAttr:'' };
      const src = meta.cands[0] || meta.placeholder;
      return `<div class="team-member" data-name="${m.name}">
        <div class="team-member-img">
          <img src="${src}" alt="${m.name}" loading="lazy" data-candidates="${meta.candsAttr||''}" data-candidate-index="0" data-fallback="${meta.placeholder}" onload="window.__onImgLoad(this)" onerror="window.__tryNextSource(this)">
          <div class="team-member-role">${m.role}</div>
        </div>
        <div class="team-member-name">${getDisplayName(m.name)}</div>
      </div>`;
    }).join('');

    return `<div class="team-card">
      <div class="team-head"><div class="team-name">${team.name} <span class="tier ${team.tier==='T0'?'t0':''}">${team.tier}</span></div></div>
      <div class="team-tags">${team.tags.map(t=>`<span class="team-tag">${t}</span>`).join('')}<span class="team-tag" style="color:var(--el-hydro);border-color:var(--el-hydro);">${team.resonance}</span></div>
      <div class="team-reason"><i class="fas fa-lightbulb" style="color:var(--gold-2);margin-right:6px;"></i>${team.reason}</div>
      <div class="team-members">${members}</div>
      <div class="team-actions">
        <button class="btn btn-sm" data-action="highlight" data-team="${team.id}"><i class="fas fa-star"></i> 高亮</button>
        <button class="btn btn-sm" data-action="editor" data-team="${team.id}"><i class="fas fa-edit"></i> 载入编辑器</button>
      </div>
    </div>`;
  }).join('');

  dom.teamGrid.querySelectorAll('.team-member').forEach(el => {
    el.addEventListener('click', () => {
      const c = CHARACTERS.find(x => x.name === el.dataset.name);
      if(c) openCharacterDetail(c.id);
    });
  });

  dom.teamGrid.querySelectorAll('[data-action="highlight"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = TEAMS.find(t => t.id === btn.dataset.team);
      if(!team) return;
      STATE.highlightNames = team.members.map(m => m.name);
      setView('characters');
      toast(`已高亮「${team.name}」`, 'fa-star');
    });
  });

  dom.teamGrid.querySelectorAll('[data-action="editor"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = TEAMS.find(t => t.id === btn.dataset.team);
      if(!team) return;
      STATE.editorSlots = team.members.map(m => m.name);
      setView('editor');
      toast(`已载入「${team.name}」`, 'fa-edit');
    });
  });
}

// ============================================================
// 武器 / 圣遗物
// ============================================================
function renderWeapons(){
  const list = STATE.weaponCatalog.filter(w => {
    if(STATE.wType !== 'all' && w.type !== STATE.wType) return false;
    if(STATE.wStar !== 'all' && w.stars !== parseInt(STATE.wStar)) return false;
    return true;
  });
  dom.weaponPageDesc.textContent = `共 ${list.length} 把武器`;
  dom.weaponCount.textContent = STATE.weaponCatalog.length;
  dom.weaponGrid.innerHTML = list.length === 0
    ? `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><h3>没有匹配的武器</h3></div>`
    : list.map(w => {
      const cands = getWeaponImageCandidates(w);
      const src = cands[0] || makeWeaponPlaceholder(w);
      const candsAttr = cands.map(u => encodeURIComponent(u)).join('|');
      return `
      <div class="weapon-card ${w.stars===5?'star5':w.stars===4?'star4':''}">
        <div class="weapon-icon weapon-image-wrap">
          <img src="${src}" alt="${w.name}" data-weapon data-candidates="${candsAttr}" data-candidate-index="0" data-fallback="${makeWeaponPlaceholder(w)}" onload="window.__onImgLoad(this)" onerror="window.__tryNextSource(this)">
          <i class="fas ${getWeaponIcon(w.type)} weapon-icon-fallback"></i>
        </div>
        <div class="weapon-name">${w.name}</div>
        <div class="weapon-meta"><span>${'★'.repeat(w.stars)}</span><span>${w.type}</span></div>
        <div class="weapon-stat">基础攻击 ${w.base} · ${w.sub}</div>
        <div class="weapon-passive">${w.passive}</div>
      </div>`;
    }).join('');
  if(!STATE.weaponCatalogLoaded) loadWeaponCatalog();
}

function renderArtifacts(){
  dom.artifactPageDesc.textContent = `共 ${ARTIFACTS.length} 套圣遗物`;
  dom.artifactCount.textContent = ARTIFACTS.length;
  dom.artifactGrid.innerHTML = ARTIFACTS.map(a => `
    <div class="weapon-card">
      <div class="weapon-icon"><i class="fas fa-gem"></i></div>
      <div class="weapon-name">${a.name}</div>
      <div class="weapon-stat">2件套：${a.bonus2}</div>
      <div class="weapon-passive">4件套：${a.bonus4}</div>
    </div>
  `).join('');
}

// ============================================================
// 抽卡
// ============================================================
function renderGacha(){
  updateGachaPoolUI();
  updateGachaStats();
  renderGachaHistory();
}

function getGachaState(){ return STATE.gacha.pools[STATE.gacha.activePool]; }
function getGachaPoolLabel(){ return STATE.gacha.activePool === 'weapon' ? '武器活动池' : '角色活动池'; }

function updateGachaPoolUI(){
  const isWeapon = STATE.gacha.activePool === 'weapon';
  $$('.gacha-pool-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.gachaPool === STATE.gacha.activePool));
  const title = $('.gacha-title');
  const note = $('#gachaPoolNote');
  if(title) title.textContent = isWeapon ? '武器活动祈愿' : '角色活动祈愿';
  if(note) note.textContent = isWeapon ? '武器池：5★ 武器 · 4★ 武器 · 定轨可选' : '角色池：5★ 角色 · 4★ 角色';
}

function updateGachaStats(){
  const g = getGachaState();
  const isWeapon = STATE.gacha.activePool === 'weapon';
  $('#statTotal').textContent = g.total;
  $('#stat5').textContent = g.count5;
  $('#stat4').textContent = g.count4;
  $('#stat3').textContent = g.count3 || 0;
  $('#statRate').textContent = g.total > 0 ? (g.count5 / g.total * 100).toFixed(2) + '%' : '0%';
  $('#statPity5').textContent = `${g.pity5}/${isWeapon ? 80 : 90}`;
  $('#statPity4').textContent = `${g.pity4}/10`;
  $('#statGuaranteed').textContent = g.guaranteed ? '是' : '否';
}

function renderGachaHistory(){
  const activePool = STATE.gacha.activePool;
  const history = STATE.gacha.history.filter(r => (r.pool || 'character') === activePool);
  dom.gachaResults.innerHTML = history.slice(-40).reverse().map(r => {
    const c = CHARACTERS.find(x => x.name === r.name);
    const w = STATE.weaponCatalog.find(x => x.name === r.name);
    const meta = c ? getCharCardMeta(c) : null;
    const src = meta ? (meta.cands[0] || meta.placeholder)
                     : (w ? (getWeaponImageCandidates(w)[0] || makeWeaponPlaceholder(w))
                          : makePlaceholder(r.name, r.element || 'geo'));
    const cls = r.stars === 5 ? 'star5' : r.stars === 4 ? 'star4' : '';
    return `<div class="gacha-result ${cls}">
      <div class="star-tag">${r.stars}★</div>
      <img src="${src}" alt="${r.name}" onerror="this.src='${makePlaceholder(r.name, r.element||'geo')}'">
      <div class="rname">${getDisplayName(r.name)}<small>${r.pool === 'weapon' ? '武器池' : '角色池'}</small></div>
    </div>`;
  }).join('');
}

function rollStar(pity5, pity4, isWeapon){
  const hardPity5 = isWeapon ? 80 : 90;
  let p5 = 0.006;
  if(pity5 >= 73) p5 = Math.min(1, 0.006 + (pity5 - 72) * 0.06);
  if(pity5 >= hardPity5 - 1) p5 = 1;

  let p4 = 0.051;
  if(pity4 >= 8) p4 = Math.min(1, 0.051 + (pity4 - 7) * 0.51);
  if(pity4 >= 9) p4 = 1;

  const roll = Math.random();
  if(roll < p5) return 5;
  if(roll < p5 + p4) return 4;
  return 3;
}

function gachaPull(count){
  const isWeapon = STATE.gacha.activePool === 'weapon';
  const g = getGachaState();
  const source = isWeapon ? STATE.weaponCatalog : CHARACTERS;
  const fivePool = source.filter(c => (c.stars || c.rarity) === 5);
  const fourPool = source.filter(c => (c.stars || c.rarity) === 4);
  const threePool = source.filter(c => (c.stars || c.rarity) === 3);

  if(fivePool.length === 0 || fourPool.length === 0){
    toast(`${getGachaPoolLabel()}数据异常`, 'fa-exclamation-circle');
    return;
  }

  const results = [];
  for(let i = 0; i < count; i++){
    g.pity5 += 1;
    g.pity4 += 1;

    const stars = rollStar(g.pity5, g.pity4, isWeapon);

    let picked;
    if(stars === 5){
      if(isWeapon && g.epitomizedPath){
        const target = fivePool.find(w => w.name === g.epitomizedPath);
        if(target){
          if(g.fatePoints >= (WEAPON_EPITOMIZED?.fatePointsMax ?? 2) || g.guaranteed){
            picked = target;
            g.fatePoints = 0;
            g.guaranteed = false;
          } else {
            if(Math.random() < 0.5){
              picked = target;
              g.fatePoints = 0;
              g.guaranteed = false;
            } else {
              picked = fivePool[Math.floor(Math.random() * fivePool.length)];
              g.fatePoints = Math.min((g.fatePoints||0) + 1, 2);
              g.guaranteed = false;
            }
          }
        } else {
          picked = fivePool[Math.floor(Math.random() * fivePool.length)];
        }
      } else {
        picked = fivePool[Math.floor(Math.random() * fivePool.length)];
      }
      g.pity5 = 0;
      g.count5++;
      g.pity4 = 0;
    } else if(stars === 4){
      picked = fourPool[Math.floor(Math.random() * fourPool.length)];
      g.pity4 = 0;
      g.count4++;
    } else {
      picked = threePool.length ? threePool[Math.floor(Math.random() * threePool.length)]
                                : fourPool[Math.floor(Math.random() * fourPool.length)];
      g.count3 = (g.count3 || 0) + 1;
    }

    const result = {
      name: picked.name,
      element: picked.element || 'geo',
      stars,
      pool: STATE.gacha.activePool,
      ts: Date.now()
    };
    results.push(result);
    STATE.gacha.history.push(result);
    g.total++;
  }

  localStorage.setItem('teyvat-gacha-history', JSON.stringify(STATE.gacha.history.slice(-200)));
  localStorage.setItem('teyvat-gacha-state', JSON.stringify({
    activePool: STATE.gacha.activePool,
    pools: STATE.gacha.pools
  }));
  renderGacha();

  const banner = document.querySelector('.gacha-banner');
  if(banner){
    banner.classList.remove('burst');
    void banner.offsetWidth;
    banner.classList.add('burst');
  }

  if(count >= 10) showGachaTenAnimation(results);

  if(results.some(r => r.stars === 5)) toast('✨ 恭喜出金！', 'fa-star');
  else if(results.some(r => r.stars === 4)) toast(`获得 4★ ${isWeapon ? '武器' : '角色'}`, 'fa-star-half-alt');
  else toast('本次无稀有奖励', 'fa-dice');
}

function showGachaTenAnimation(results){
  const overlay = document.createElement('div');
  overlay.className = 'gacha-anim-overlay';

  const maxStar = results.reduce((b, r) => Math.max(b, r.stars), 0);
  const fiveStarResults = results.filter(r => r.stars === 5);
  const highlight = fiveStarResults.length ? fiveStarResults[fiveStarResults.length - 1] : results[results.length - 1];
  const c = CHARACTERS.find(x => x.name === highlight.name);
  const meta = c ? getCharCardMeta(c) : null;
  const highlightSrc = meta ? (meta.cands[0] || meta.placeholder) : makePlaceholder(highlight.name, highlight.element);

  const particles = Array.from({length:48}, (_, i) => {
    const left = 4 + (i*17) % 92;
    const top = 6 + (i*13) % 78;
    const size = 4 + (i%6)*2;
    const delay = (i%12)*0.12;
    const hue = i%2 === 0 ? 42 : 54;
    return `<span class="gacha-particle" style="--x:${left}%;--y:${top}%;--size:${size}px;--delay:${delay}s;--hue:${hue};"></span>`;
  }).join('');

  overlay.innerHTML = `
    <div class="gacha-anim-panel">
      <div class="gacha-particle-layer">${particles}</div>
      <div class="gacha-flash"></div>
      <div class="gacha-anim-header">
        <div class="gacha-anim-title">十连抽卡</div>
        <div class="gacha-anim-actions">
          <button class="gacha-skip-btn">跳过</button>
          <button class="gacha-close-btn"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="gacha-hero-summary">
        <div class="gacha-hero-portrait star${maxStar}">
          <div class="gacha-portrait-glow"></div>
          <img src="${highlightSrc}" alt="${highlight.name}" onerror="this.src='${makePlaceholder(highlight.name, highlight.element)}'">
        </div>
        <div class="gacha-hero-copy">
          <div class="gacha-hero-label">本次祈愿</div>
          <div class="gacha-hero-name">${getDisplayName(highlight.name)}</div>
          <div class="gacha-hero-stars">${'★'.repeat(maxStar)}</div>
        </div>
      </div>
      <div class="gacha-result-banner">获得角色</div>
      <div class="gacha-roll-grid"></div>
      <div class="gacha-anim-footer">
        <span>祈愿结果</span>
        <strong>${fiveStarResults.length} 个 5★</strong>
        <button class="gacha-replay gacha-skip-btn"><i class="fas fa-redo"></i> 再来一次</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const panel = overlay.querySelector('.gacha-anim-panel');
  const heroPortrait = overlay.querySelector('.gacha-hero-portrait');
  const heroName = overlay.querySelector('.gacha-hero-name');
  const flash = overlay.querySelector('.gacha-flash');
  const grid = overlay.querySelector('.gacha-roll-grid');
  const resultBanner = overlay.querySelector('.gacha-result-banner');
  const closeBtn = overlay.querySelector('.gacha-close-btn');
  const skipBtn = overlay.querySelector('.gacha-anim-actions .gacha-skip-btn');
  const replayBtn = overlay.querySelector('.gacha-replay');
  const timers = [];
  let finished = false;

  const close = () => {
    timers.forEach(clearTimeout);
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };
  closeBtn.addEventListener('click', close);
  replayBtn.addEventListener('click', () => { close(); setTimeout(() => gachaPull(10), 300); });
  overlay.addEventListener('click', e => { if(e.target === overlay) close(); });

  const addCard = result => {
    const card = document.createElement('div');
    const cc = CHARACTERS.find(x => x.name === result.name);
    const m = cc ? getCharCardMeta(cc) : null;
    const src = m ? (m.cands[0] || m.placeholder) : makePlaceholder(result.name, result.element);
    card.className = `gacha-roll-card star${result.stars}`;
    card.innerHTML = `<div class="gacha-roll-star">${result.stars}★</div><img src="${src}" alt="${result.name}" onerror="this.src='${makePlaceholder(result.name, result.element)}'"><div class="gacha-roll-name">${getDisplayName(result.name)}</div>`;
    grid.appendChild(card);
    requestAnimationFrame(() => card.classList.add('show'));
  };

  const finish = () => {
    if(finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    results.forEach(r => {
      const card = document.createElement('div');
      const cc = CHARACTERS.find(x => x.name === r.name);
      const m = cc ? getCharCardMeta(cc) : null;
      const src = m ? (m.cands[0] || m.placeholder) : makePlaceholder(r.name, r.element);
      card.className = `gacha-roll-card star${r.stars} show`;
      card.innerHTML = `<div class="gacha-roll-star">${r.stars}★</div><img src="${src}" alt="${r.name}" onerror="this.src='${makePlaceholder(r.name, r.element)}'"><div class="gacha-roll-name">${getDisplayName(r.name)}</div>`;
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    panel.classList.add('show-grid');
    resultBanner.classList.add('show');
  };
  skipBtn.addEventListener('click', finish);

  timers.push(setTimeout(() => {
    overlay.classList.add('show');
    flash.classList.add('active');
    setTimeout(() => {
      flash.classList.remove('active');
      heroPortrait.classList.add('reveal');
    }, 260);
  }, 30));

  timers.push(setTimeout(() => {
    const fiveResults = results.filter(r => r.stars === 5);
    const fourResults = results.filter(r => r.stars === 4);
    fiveResults.forEach((r, i) => timers.push(setTimeout(() => addCard(r), i * 260)));
    timers.push(setTimeout(() => {
      panel.classList.add('show-grid');
      fourResults.forEach((r, i) => timers.push(setTimeout(() => addCard(r), i * 120)));
      timers.push(setTimeout(() => {
        resultBanner.classList.add('show');
        finished = true;
      }, fourResults.length * 120 + 280));
    }, Math.max(620, fiveResults.length * 260 + 260)));
  }, 700));
}

function resetGacha(){
  STATE.gacha.pools.character = { ...GACHA_DEFAULT_STATE };
  STATE.gacha.pools.weapon = { ...GACHA_DEFAULT_STATE };
  STATE.gacha.history = [];
  localStorage.setItem('teyvat-gacha-history', '[]');
  localStorage.setItem('teyvat-gacha-state', JSON.stringify({ activePool: STATE.gacha.activePool, pools: STATE.gacha.pools }));
  renderGacha();
  toast('统计已重置', 'fa-redo');
}

// ============================================================
// 材料计算器
// ============================================================
function renderCalculator(){
  dom.calcCharList.innerHTML = CHARACTERS.map(c => {
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    const sel = STATE.calcSelected.has(c.name) ? 'selected' : '';
    return `<div class="calc-char-item ${sel}" data-name="${c.name}">
      <img src="${src}" alt="${c.name}" loading="lazy" onerror="this.src='${meta.placeholder}'">
      <div class="check"><i class="fas fa-check"></i></div>
    </div>`;
  }).join('');

  dom.calcCharList.querySelectorAll('.calc-char-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      if(STATE.calcSelected.has(name)) STATE.calcSelected.delete(name);
      else STATE.calcSelected.add(name);
      renderCalculator();
    });
  });

  renderCalcSummary();
}

function renderCalcSummary(){
  const chars = CHARACTERS.filter(c => STATE.calcSelected.has(c.name));
  if(chars.length === 0){
    dom.calcSummary.innerHTML = `<div class="empty-state" style="padding:40px 10px;"><i class="fas fa-calculator"></i><h3>还没有选择角色</h3><p>点击左侧角色头像加入计算</p></div>`;
    return;
  }

  const mats = {};
  const add = (name, icon, count, from) => {
    if(!mats[name]) mats[name] = { name, icon, count:0, from };
    mats[name].count += count;
  };

  chars.forEach(c => {
    const bm = BREAK_MATERIALS[c.element];
    add(bm.gem, 'fa-gem', 55, c.element + '元素');
    add(bm.local, 'fa-leaf', 168, c.region);
    add(bm.boss, 'fa-dragon', 46, 'Boss 掉落');
    add(bm.common, 'fa-flask', 84, '怪物掉落');
    add('摩拉', 'fa-coins', 2092000, '通用货币');
    add('经验书', 'fa-book', 419, '通用');
  });

  const list = Object.values(mats).sort((a,b) => b.count - a.count);
  dom.calcSummary.innerHTML = `
    <div style="font-size:12px;color:var(--text-3);margin-bottom:12px;">已选 ${chars.length} 位角色 · 共 ${list.length} 种材料</div>
    <div class="calc-summary-list">
      ${list.map(m => `
        <div class="calc-mat-row">
          <div class="calc-mat-icon"><i class="fas ${m.icon}"></i></div>
          <div class="calc-mat-info"><div class="calc-mat-name">${m.name}</div><div class="calc-mat-from">${m.from}</div></div>
          <div class="calc-mat-count">×${m.count.toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// 编辑器
// ============================================================
function renderEditor(){
  dom.editorSlots.innerHTML = STATE.editorSlots.map((name, i) => {
    if(!name) return `<div class="editor-slot empty" data-slot="${i}"></div>`;
    const c = CHARACTERS.find(x => x.name === name);
    if(!c) return `<div class="editor-slot empty" data-slot="${i}"></div>`;
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    return `<div class="editor-slot" data-slot="${i}">
      <img src="${src}" alt="${c.name}" onerror="this.src='${meta.placeholder}'">
      <div class="slot-name">${getDisplayName(c.name)}</div>
      <button class="slot-remove" data-remove="${i}"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');

  dom.editorSlots.querySelectorAll('.editor-slot').forEach(el => {
    el.addEventListener('click', e => {
      if(e.target.closest('.slot-remove')) return;
      openPicker(parseInt(el.dataset.slot));
    });
  });

  dom.editorSlots.querySelectorAll('.slot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      STATE.editorSlots[parseInt(btn.dataset.remove)] = null;
      renderEditor();
    });
  });

  renderSavedTeams();
}

function renderSavedTeams(){
  if(STATE.savedTeams.length === 0){ dom.editorSaved.style.display = 'none'; return; }
  dom.editorSaved.style.display = 'block';
  dom.editorSavedList.innerHTML = STATE.savedTeams.map((t, i) => `
    <div class="editor-saved-item">
      <span class="name">${t.name}</span>
      <button data-load="${i}">载入</button>
      <button data-del="${i}">删除</button>
    </div>
  `).join('');

  dom.editorSavedList.querySelectorAll('[data-load]').forEach(b => {
    b.addEventListener('click', () => {
      STATE.editorSlots = [...STATE.savedTeams[parseInt(b.dataset.load)].slots];
      renderEditor();
      toast('已载入配队', 'fa-folder-open');
    });
  });

  dom.editorSavedList.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      STATE.savedTeams.splice(parseInt(b.dataset.del), 1);
      localStorage.setItem('teyvat-saved-teams', JSON.stringify(STATE.savedTeams));
      renderSavedTeams();
    });
  });
}

function openPicker(slotIndex){
  dom.pickerGrid.innerHTML = CHARACTERS.map(c => {
    const e = ELEMENTS[c.element];
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    const sel = STATE.editorSlots[slotIndex] === c.name ? 'selected' : '';
    return `<div class="picker-item ${sel}" data-name="${c.name}">
      <img src="${src}" alt="${c.name}" onerror="this.src='${meta.placeholder}'">
      <div class="picker-name">${getDisplayName(c.name)}</div>
      <div class="picker-elem">${e.name} · ${c.weapon}</div>
    </div>`;
  }).join('');

  dom.pickerGrid.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', () => {
      STATE.editorSlots[slotIndex] = el.dataset.name;
      dom.pickerOverlay.classList.remove('show');
      renderEditor();
    });
  });

  dom.pickerOverlay.classList.add('show');
}

// ============================================================
// 对比
// ============================================================
function renderCompare(){
  dom.compareCount.textContent = STATE.compareList.length;
  dom.compareBadge.textContent = STATE.compareList.length;
  dom.compareBadge.style.display = STATE.compareList.length > 0 ? 'grid' : 'none';

  if(STATE.compareList.length === 0){
    dom.compareWrap.innerHTML = `<div class="empty-state"><i class="fas fa-balance-scale"></i><h3>还没有选择角色</h3><p>在角色图鉴中点击卡片右上角的 <i class="fas fa-plus" style="color:var(--el-hydro);"></i> 加入对比（最多 4 位）</p></div>`;
    return;
  }

  const chars = STATE.compareList.map(n => CHARACTERS.find(c => c.name === n)).filter(Boolean);
  const rows = [
    { label:'头像', render: c => {
      const meta = getCharCardMeta(c);
      const src = meta.cands[0] || meta.placeholder;
      return `<div class="compare-cell-char"><img src="${src}" alt="${c.name}" onerror="this.src='${meta.placeholder}'"><div class="name">${getDisplayName(c.name)}</div></div>`;
    }},
    { label:'元素', render: c => { const e = ELEMENTS[c.element]; return `<span style="color:${e.color};font-weight:700;"><i class="fas ${e.icon}"></i> ${e.name}</span>`; }},
    { label:'武器', render: c => `<i class="fas ${getWeaponIcon(c.weapon)}" style="color:var(--gold-2);"></i> ${c.weapon}` },
    { label:'稀有度', render: c => Array(c.rarity).fill('<i class="fas fa-star" style="color:#ffd966;"></i>').join('') },
    { label:'地区', render: c => c.region },
    { label:'描述', render: c => `<span style="font-size:12px;font-style:italic;color:var(--text-3);">${c.desc}</span>` }
  ];

  dom.compareWrap.innerHTML = `<table class="compare-table">
    <thead><tr><th style="text-align:left;">属性</th>${chars.map(c=>`<th>${getDisplayName(c.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><td class="row-label">${r.label}</td>${chars.map(c=>`<td>${r.render(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// ============================================================
// 收藏
// ============================================================
function renderFavorites(){
  const favs = CHARACTERS.filter(c => STATE.favorites.has(c.name));
  const grid = document.getElementById('favoritesGrid');
  const desc = document.getElementById('favoritesDesc');
  if(!grid) return;
  desc.textContent = `已收藏 ${favs.length} 位角色`;

  if(favs.length === 0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-heart"></i><h3>还没有收藏角色</h3><p>在角色卡片上点击 ♡ 收藏</p></div>`;
    return;
  }

  grid.innerHTML = favs.map(c => {
    const e = ELEMENTS[c.element];
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    const stars = Array(c.rarity).fill('<i class="fas fa-star"></i>').join('');
    return `
      <div class="char-card" data-id="${c.id}" data-name="${c.name}">
        <div class="char-img">
          <img src="${src}" alt="${c.name}" loading="lazy" data-candidates="${meta.candsAttr}" data-candidate-index="0" onload="window.__onImgLoad(this)" onerror="window.__tryNextSource(this)">
          <div class="char-rarity">${stars}</div>
          <button class="fav-btn active" data-fav="${c.name}"><i class="fas fa-heart"></i></button>
          <div class="char-element" style="color:${e.color};"><i class="fas ${e.icon}"></i></div>
        </div>
        <div class="char-info">
          <div class="char-name">${getDisplayName(c.name)}</div>
          <div class="char-meta">
            <span class="char-weapon"><i class="fas ${getWeaponIcon(c.weapon)}"></i>${c.weapon}</span>
            <span class="char-region"><i class="fas fa-map-pin"></i>${c.region}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', e => {
      if(e.target.closest('.fav-btn')){
        e.stopPropagation();
        toggleFavorite(e.target.closest('.fav-btn').dataset.fav);
        return;
      }
      const c = CHARACTERS.find(x => x.id === parseInt(card.dataset.id));
      if(c) openCharacterDetail(c.id);
    });
  });
}

// ============================================================
// 强度排行
// ============================================================
function renderTierList(){
  const container = document.getElementById('tierListContainer');
  if(!container) return;

  container.innerHTML = `
    <div style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:16px;">
      <i class="fas fa-info-circle"></i> 评级基于深渊使用率、配队灵活度、输出上限综合评估
    </div>
    ${Object.entries(TIER_LIST).map(([name, info]) => {
      if(!info.chars || !info.chars.length) return '';
      return `
        <div class="tier-row">
          <div class="tier-header" style="background:linear-gradient(135deg,${info.color},${info.color}80);">
            <div class="tier-name">${name}</div>
            <div class="tier-label">${info.label}</div>
          </div>
          <div class="tier-chars">
            ${info.chars.map(n => {
              const c = CHARACTERS.find(x => x.name === n);
              if(!c) return '';
              const meta = getCharCardMeta(c);
              const src = meta.cands[0] || meta.placeholder;
              return `<div class="tier-char" data-name="${c.name}">
                <img src="${src}" alt="${c.name}" onerror="this.src='${meta.placeholder}'">
                <div class="tier-char-name">${c.name}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="tier-desc">${info.desc}</div>
        </div>`;
    }).join('')}
  `;

  container.querySelectorAll('.tier-char').forEach(el => {
    el.addEventListener('click', () => {
      const c = CHARACTERS.find(x => x.name === el.dataset.name);
      if(c) openCharacterDetail(c.id);
    });
  });
}

// ============================================================
// 素材日历
// ============================================================
function renderCalendar(){
  const container = document.getElementById('calendarContainer');
  if(!container) return;
  const today = new Date().getDay();
  const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
  const isToday = (name, info) => today === 0 || (info.days && info.days.includes(today));

  container.innerHTML = `
    <div class="calendar-header">
      <div class="calendar-today">
        <i class="fas fa-calendar-day"></i>
        今天是 <strong>${dayNames[today]}</strong>，可刷取的素材：
      </div>
    </div>
    <div class="calendar-grid">
      ${Object.entries(TALENT_BOOKS).map(([name, info]) => {
        const active = isToday(name, info);
        return `
          <div class="calendar-item ${active?'today':''}" style="--region-color:${info.color};">
            <div class="calendar-book-icon"><i class="fas fa-book"></i></div>
            <div class="calendar-book-name">${name}</div>
            <div class="calendar-book-region">${info.region}</div>
            ${active ? '<div class="calendar-today-badge">今日可刷</div>' : ''}
          </div>`;
      }).join('')}
    </div>
    <div style="margin-top:24px;font-size:12px;color:var(--text-3);text-align:center;">
      <i class="fas fa-info-circle"></i> 周日所有素材均可刷取
    </div>
  `;
}

// ============================================================
// 天赋计算器
// ============================================================
function renderTalentCalc(){
  const container = document.getElementById('talentCalcContainer');
  if(!container) return;

  const selected = STATE.talentSelected || new Set();
  STATE.talentSelected = selected;
  const target = STATE.talentTarget || '9-9-9';
  const cost = TALENT_COST[target] || { 教导:9, 指引:63, 哲学:9, 摩拉:3562500 };

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 360px;gap:24px;">
      <div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:12px;">
          <i class="fas fa-info-circle"></i> 选择角色，计算天赋升到 <strong>${target}</strong> 所需材料
        </div>
        <div class="talent-target-bar">
          <span>目标等级：</span>
          ${['6-6-6','8-8-8','9-9-9','10-10-10'].map(t => `
            <button class="chip ${target===t?'active':''}" data-target="${t}">${t}</button>
          `).join('')}
        </div>
        <div class="calc-char-list" id="talentCharList" style="margin-top:16px;max-height:none;"></div>
      </div>
      <div class="calc-summary">
        <div class="calc-summary-title"><i class="fas fa-clipboard-list"></i> 天赋材料汇总</div>
        <div class="calc-summary-list" id="talentSummary"></div>
      </div>
    </div>
  `;

  const list = document.getElementById('talentCharList');
  list.innerHTML = CHARACTERS.map(c => {
    const meta = getCharCardMeta(c);
    const src = meta.cands[0] || meta.placeholder;
    const sel = selected.has(c.name) ? 'selected' : '';
    return `<div class="calc-char-item ${sel}" data-name="${c.name}">
      <img src="${src}" alt="${c.name}" onerror="this.src='${meta.placeholder}'">
      <div class="check"><i class="fas fa-check"></i></div>
    </div>`;
  }).join('');

  list.querySelectorAll('.calc-char-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      if(selected.has(name)) selected.delete(name);
      else selected.add(name);
      renderTalentCalc();
    });
  });

  container.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.talentTarget = btn.dataset.target;
      renderTalentCalc();
    });
  });

  const summary = document.getElementById('talentSummary');
  const chars = CHARACTERS.filter(c => selected.has(c.name));

  if(chars.length === 0){
    summary.innerHTML = `<div class="empty-state" style="padding:40px 10px;"><i class="fas fa-book"></i><h3>还没有选择角色</h3><p>点击左侧角色加入计算</p></div>`;
    return;
  }

  const mats = {};
  const add = (name, icon, count, from) => {
    if(!mats[name]) mats[name] = { name, icon, count:0, from };
    mats[name].count += count;
  };

  chars.forEach(c => {
    const book = (CHAR_TALENT_BOOK && CHAR_TALENT_BOOK[c.name]) || '自由';
    const info = TALENT_BOOKS[book] || { region:'未知', days:[] };
    const from = info.days && info.days.length
      ? info.region + ' · 周' + info.days.map(d => ['日','一','二','三','四','五','六'][d]).join('/周')
      : info.region;
    add(`天赋书·${book}·教导`, 'fa-book', cost.教导 || 0, from);
    add(`天赋书·${book}·指引`, 'fa-book', cost.指引 || 0, from);
    add(`天赋书·${book}·哲学`, 'fa-book', cost.哲学 || 0, from);
    add('摩拉', 'fa-coins', cost.摩拉 || 0, '通用');
  });

  const listMats = Object.values(mats);
  summary.innerHTML = `
    <div style="font-size:12px;color:var(--text-3);margin-bottom:12px;">已选 ${chars.length} 位角色 · 目标 ${target}</div>
    ${listMats.map(m => `
      <div class="calc-mat-row">
        <div class="calc-mat-icon"><i class="fas ${m.icon}"></i></div>
        <div class="calc-mat-info"><div class="calc-mat-name">${m.name}</div><div class="calc-mat-from">${m.from}</div></div>
        <div class="calc-mat-count">×${m.count.toLocaleString()}</div>
      </div>
    `).join('')}
  `;
}

// ============================================================
// 搜索
// ============================================================
function performSearch(query){
  if(!query.trim()){ dom.searchDropdown.classList.remove('show'); return; }
  const k = query.trim().toLowerCase();
  const results = [];

  CHARACTERS.forEach(c => {
    if(c.name.toLowerCase().includes(k) || getDisplayName(c.name).toLowerCase().includes(k))
      results.push({ type:'角色', name:c.name, element:c.element, data:c });
  });
  WEAPONS.forEach(w => {
    if(w.name.toLowerCase().includes(k)) results.push({ type:'武器', name:w.name, element:'geo', data:w });
  });
  TEAMS.forEach(t => {
    if(t.name.toLowerCase().includes(k) || t.tags.some(tag => tag.includes(k)))
      results.push({ type:'阵容', name:t.name, element:t.members[0].element, data:t });
  });

  const sliced = results.slice(0, 12);
  if(sliced.length === 0){
    dom.searchDropdown.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3);font-size:12px;"><i class="fas fa-search" style="display:block;font-size:24px;margin-bottom:8px;opacity:0.4;"></i>没有找到「${query}」</div>`;
  } else {
    dom.searchDropdown.innerHTML = sliced.map(r => {
      if(r.type === '角色'){
        const e = ELEMENTS[r.element];
        const meta = getCharCardMeta(r.data);
        const src = meta.cands[0] || meta.placeholder;
        return `<div class="search-result" data-type="char" data-id="${r.data.id}">
          <img class="search-result-img" src="${src}" onerror="this.src='${meta.placeholder}'">
          <div class="search-result-info"><div class="search-result-name">${getDisplayName(r.name)}</div><div class="search-result-meta"><span style="color:${e.color};"><i class="fas ${e.icon}"></i> ${e.name}</span><span>${r.data.weapon}</span><span>${r.data.region}</span></div></div>
          <span class="search-result-type">${r.type}</span>
        </div>`;
      } else if(r.type === '武器'){
        return `<div class="search-result" data-type="weapon">
          <div class="search-result-img" style="display:grid;place-items:center;background:var(--bg-3);color:var(--gold-2);font-size:18px;"><i class="fas fa-sword"></i></div>
          <div class="search-result-info"><div class="search-result-name">${r.name}</div><div class="search-result-meta"><span>${'★'.repeat(r.data.stars)}</span><span>${r.data.type}</span></div></div>
          <span class="search-result-type">${r.type}</span>
        </div>`;
      } else {
        return `<div class="search-result" data-type="team">
          <div class="search-result-img" style="display:grid;place-items:center;background:var(--bg-3);color:var(--gold-2);font-size:18px;"><i class="fas fa-crown"></i></div>
          <div class="search-result-info"><div class="search-result-name">${r.name}</div><div class="search-result-meta"><span>${r.data.tier}</span><span>${r.data.resonance}</span></div></div>
          <span class="search-result-type">${r.type}</span>
        </div>`;
      }
    }).join('');
  }

  dom.searchDropdown.classList.add('show');
  dom.searchDropdown.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      if(type === 'char'){
        const c = CHARACTERS.find(x => x.id === parseInt(el.dataset.id));
        if(c) openCharacterDetail(c.id);
      } else if(type === 'weapon') setView('weapons');
      else setView('teams');
      dom.searchDropdown.classList.remove('show');
      dom.searchInput.value = '';
    });
  });
}

// ============================================================
// 浮动条 / 元素 chips
// ============================================================
function updateElementChips(){
  $$('.element-chip').forEach(chip => {
    const el = chip.dataset.el;
    chip.classList.toggle('active', el === STATE.element || (el === 'all' && STATE.element === 'all'));
  });
}

function updateFloatingBar(){
  const need = STATE.highlightNames.length > 0 || STATE.compareList.length > 0;
  dom.floatingBar.classList.toggle('show', need);
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents(){
  document.querySelector('.sidebar').addEventListener('click', e => {
    const item = e.target.closest('.nav-item[data-view]');
    if(!item) return;
    setView(item.dataset.view);
    dom.sidebar.classList.remove('open');
    dom.sidebarBackdrop.classList.remove('show');
  });

  document.getElementById('elementGrid').addEventListener('click', e => {
    const chip = e.target.closest('.element-chip');
    if(!chip) return;
    STATE.element = chip.dataset.el;
    STATE.highlightNames = [];
    updateElementChips();
    if(STATE.view !== 'characters') setView('characters');
    else renderCharacters();
  });

  document.querySelectorAll('.filters-bar').forEach(bar => {
    bar.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if(!chip) return;
      if(chip.dataset.weapon !== undefined){
        STATE.weapon = chip.dataset.weapon;
        bar.querySelectorAll('[data-weapon]').forEach(b => b.classList.toggle('active', b === chip));
        renderCharacters();
      } else if(chip.dataset.rarity !== undefined){
        STATE.rarity = chip.dataset.rarity;
        bar.querySelectorAll('[data-rarity]').forEach(b => b.classList.toggle('active', b === chip));
        renderCharacters();
      } else if(chip.dataset.region !== undefined){
        STATE.region = chip.dataset.region;
        bar.querySelectorAll('[data-region]').forEach(b => b.classList.toggle('active', b === chip));
        renderCharacters();
      } else if(chip.dataset.wtype !== undefined){
        STATE.wType = chip.dataset.wtype;
        bar.querySelectorAll('[data-wtype]').forEach(b => b.classList.toggle('active', b === chip));
        renderWeapons();
      } else if(chip.dataset.wstar !== undefined){
        STATE.wStar = chip.dataset.wstar;
        bar.querySelectorAll('[data-wstar]').forEach(b => b.classList.toggle('active', b === chip));
        renderWeapons();
      }
    });
  });

  const sortMap = { 'default':'默认排序','rarity-desc':'星级 ↓','rarity-asc':'星级 ↑','name':'名称','element':'元素','region':'地区' };
  const sortKeys = Object.keys(sortMap);
  $('#sortBtn').addEventListener('click', () => {
    const idx = sortKeys.indexOf(STATE.sort);
    STATE.sort = sortKeys[(idx+1) % sortKeys.length];
    $('#sortLabel').textContent = sortMap[STATE.sort];
    renderCharacters();
  });

  $('#resetFilterBtn').addEventListener('click', () => {
    STATE.element = 'all'; STATE.weapon = 'all'; STATE.rarity = 'all'; STATE.region = 'all';
    STATE.search = ''; STATE.highlightNames = []; STATE.sort = 'default';
    dom.searchInput.value = ''; $('#sortLabel').textContent = '默认排序';
    $$('[data-weapon]').forEach(b => b.classList.toggle('active', b.dataset.weapon === 'all'));
    $$('[data-rarity]').forEach(b => b.classList.toggle('active', b.dataset.rarity === 'all'));
    $$('[data-region]').forEach(b => b.classList.toggle('active', b.dataset.region === 'all'));
    updateElementChips();
    renderCharacters();
    toast('已重置所有筛选', 'fa-redo');
  });

  dom.searchInput.addEventListener('input', debounce(e => performSearch(e.target.value), 200));
  dom.searchInput.addEventListener('focus', e => { if(e.target.value.trim()) performSearch(e.target.value); });
  document.addEventListener('click', e => { if(!e.target.closest('.global-search')) dom.searchDropdown.classList.remove('show'); });

  dom.charGrid.addEventListener('click', e => {
    const card = e.target.closest('.char-card');
    if(!card) return;
    if(e.target.closest('.compare-btn')){
      e.stopPropagation();
      toggleCompare(e.target.closest('.compare-btn').dataset.compare);
      return;
    }
    if(e.target.closest('.fav-btn')){
      e.stopPropagation();
      toggleFavorite(e.target.closest('.fav-btn').dataset.fav);
      return;
    }
    openCharacterDetail(parseInt(card.dataset.id));
  });

  $('#floatReset').addEventListener('click', () => {
    STATE.highlightNames = []; STATE.compareList = [];
    renderCharacters(); updateFloatingBar();
    dom.compareBadge.style.display = 'none';
    toast('已返回全部', 'fa-undo-alt');
  });
  $('#floatCompare').addEventListener('click', () => {
    if(STATE.compareList.length === 0){ toast('请先选择要对比的角色', 'fa-exclamation-circle'); return; }
    setView('compare');
  });
  $('#compareBtn').addEventListener('click', () => setView('compare'));
  $('#clearCompareBtn').addEventListener('click', () => {
    STATE.compareList = [];
    renderCompare(); updateFloatingBar(); renderCharacters();
    toast('已清空对比', 'fa-trash');
  });

  dom.themeBtn.addEventListener('click', () => {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', STATE.theme);
    localStorage.setItem('teyvat-theme', STATE.theme);
    dom.themeBtn.innerHTML = `<i class="fas fa-${STATE.theme==='dark'?'moon':'sun'}"></i>`;
    toast(`已切换到${STATE.theme==='dark'?'暗色':'亮色'}主题`, 'fa-palette');
  });
  dom.langBtn.addEventListener('click', () => {
    STATE.lang = STATE.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('teyvat-lang', STATE.lang);
    STATE.charCardMeta = {};
    toast(`Language: ${STATE.lang==='zh'?'中文':'English'}`, 'fa-language');
    renderCharacters(); renderTeams();
  });

  $('#menuToggle').addEventListener('click', () => {
    dom.sidebar.classList.toggle('open');
    dom.sidebarBackdrop.classList.toggle('show');
  });
  dom.sidebarBackdrop.addEventListener('click', () => {
    dom.sidebar.classList.remove('open');
    dom.sidebarBackdrop.classList.remove('show');
  });

  $('#gachaSingle').addEventListener('click', () => gachaPull(1));
  $('#gachaTen').addEventListener('click', () => gachaPull(10));
  $('#gachaReset').addEventListener('click', resetGacha);
  $$('.gacha-pool-tab').forEach(tab => tab.addEventListener('click', () => {
    STATE.gacha.activePool = tab.dataset.gachaPool;
    localStorage.setItem('teyvat-gacha-state', JSON.stringify({ activePool: STATE.gacha.activePool, pools: STATE.gacha.pools }));
    renderGacha();
    toast(`已切换至${getGachaPoolLabel()}`, 'fa-exchange-alt');
  }));

  $('#calcClear').addEventListener('click', () => {
    STATE.calcSelected.clear();
    renderCalculator();
    toast('已清空选择', 'fa-times');
  });

  $('#editorReset').addEventListener('click', () => {
    STATE.editorSlots = [null,null,null,null];
    renderEditor();
    toast('已重置', 'fa-redo');
  });
  $('#editorRandom').addEventListener('click', () => {
    const pool = [...CHARACTERS];
    STATE.editorSlots = [null,null,null,null].map(() => {
      const idx = Math.floor(Math.random() * pool.length);
      return pool.splice(idx, 1)[0].name;
    });
    renderEditor();
    toast('随机配队完成', 'fa-shuffle');
  });
  $('#editorSave').addEventListener('click', () => {
    const valid = STATE.editorSlots.filter(Boolean);
    if(valid.length < 1){ toast('至少选择 1 位角色', 'fa-exclamation-circle'); return; }
    const name = prompt('给这个配队起个名字：', `我的配队 ${STATE.savedTeams.length + 1}`);
    if(!name) return;
    STATE.savedTeams.push({ name, slots: [...STATE.editorSlots] });
    localStorage.setItem('teyvat-saved-teams', JSON.stringify(STATE.savedTeams));
    renderSavedTeams();
    toast('配队已保存', 'fa-save');
  });

  $('#pickerClose').addEventListener('click', () => dom.pickerOverlay.classList.remove('show'));
  dom.pickerOverlay.addEventListener('click', e => { if(e.target === dom.pickerOverlay) dom.pickerOverlay.classList.remove('show'); });

  document.addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT'){
      if(e.key === 'Escape'){ dom.searchInput.blur(); dom.searchDropdown.classList.remove('show'); }
      return;
    }
    if(e.key === '/' || (e.ctrlKey && e.key === 'k')){ e.preventDefault(); dom.searchInput.focus(); }
    if(e.key === 'Escape'){
      dom.pickerOverlay.classList.remove('show');
      if(STATE.view === 'detail') setView('characters');
    }
    if(e.key === 't') dom.themeBtn.click();
    if(e.key === 'l') dom.langBtn.click();
  });
}

// ============================================================
// 星空背景
// ============================================================
function initStarfield(){
  const canvas = document.getElementById('starfield');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, stars = [];
  let rafId = null;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = [];
    const count = Math.floor(w * h / 9000);
    for(let i = 0; i < count; i++){
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3, a: Math.random(),
        da: (Math.random()*0.015+0.003) * (Math.random()>0.5?1:-1),
        vx: (Math.random()-0.5)*0.12, vy: (Math.random()-0.5)*0.12
      });
    }
  }

  function draw(){
    ctx.clearRect(0, 0, w, h);
    stars.forEach(s => {
      s.a += s.da;
      if(s.a > 1 || s.a < 0.15){ s.da *= -1; s.a = Math.max(0.15, Math.min(1, s.a)); }
      s.x += s.vx; s.y += s.vy;
      if(s.x < 0) s.x = w; if(s.x > w) s.x = 0;
      if(s.y < 0) s.y = h; if(s.y > h) s.y = 0;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${s.a * 0.55})`;
      ctx.fill();
    });
    rafId = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();

  document.addEventListener('visibilitychange', () => {
    if(document.hidden && rafId){ cancelAnimationFrame(rafId); rafId = null; }
    else if(!document.hidden && !rafId){ draw(); }
  });
}

// ============================================================
// 暴露给外部模块
// ============================================================
TA.openCharacterDetail = openCharacterDetail;
TA.getImageCandidates = getImageCandidates;
TA.makePlaceholder = makePlaceholder;
TA.getCharCardMeta = getCharCardMeta;
TA.setView = setView;
TA.CHARACTERS = CHARACTERS;
TA.TEAMS = TEAMS;
TA.ELEMENTS = ELEMENTS;

// ============================================================
// 初始化
// ============================================================
function init(){
  document.body.setAttribute('data-theme', STATE.theme);
  dom.themeBtn.innerHTML = `<i class="fas fa-${STATE.theme==='dark'?'moon':'sun'}"></i>`;
  initStarfield();
  bindEvents();
  updateElementChips();
  initAbyss();
  initAchievements();

  const hash = window.location.hash.replace('#/', '').split('/');
  const validViews = ['dashboard','characters','teams','weapons','artifacts','gacha','calculator','editor','compare','favorites','abyss','achievements','tierlist','calendar','talent'];
  if(hash[0] === 'character' && hash[1]) openCharacterDetail(parseInt(hash[1]));
  else if(validViews.includes(hash[0])) setView(hash[0]);
  else setView('dashboard');

  console.log('%c✨ 提瓦特档案馆 v5.1 已加载', 'color:#d4af37;font-size:16px;font-weight:bold;');
  console.log(`%c${CHARACTERS.length} 位角色 · ${TEAMS.length} 套阵容 · ${WEAPONS.length} 把武器 · ${ARTIFACTS.length} 套圣遗物`, 'color:#8ab4d4;font-size:12px;');
}

window.addEventListener('load', init);