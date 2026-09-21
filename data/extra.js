/* ============================================================
   提瓦特档案馆 · 数据扩展 v5.0
   修复：去掉与 data-full.js 重复的 CHAR_TALENT_BOOK
   ============================================================ */

export const TIER_LIST = {
  T0: { label:'顶级', desc:'深渊必备，无可替代', color:'#ff6b6b',
        chars:['那维莱特','芙宁娜','阿蕾奇诺','钟离','纳西妲','枫原万叶','玛薇卡'] },
  T1: { label:'一线', desc:'强力泛用，深渊常客', color:'#ffb84d',
        chars:['雷电将军','胡桃','夜兰','甘雨','神里绫华','八重神子','珊瑚宫心海','妮露','艾尔海森','基尼奇','希诺宁','恰斯卡'] },
  T2: { label:'二线', desc:'特定场合表现优秀', color:'#d4af37',
        chars:['温迪','迪卢克','可莉','优菈','魈','刻晴','达达利亚','宵宫','神里绫人','荒泷一斗','提纳里','赛诺','流浪者','迪希雅','林尼','娜维娅','克洛琳德','莱欧斯利','菲林斯','瓦蕾莎','奥萝拉'] },
  T3: { label:'三线', desc:'需高练度或特定配队', color:'#8bc34a',
        chars:['琴','莫娜','阿贝多','安柏','凯亚','丽莎','芭芭拉','雷泽','菲谢尔','砂糖','诺艾尔','班尼特','迪奥娜','罗莎莉亚','米卡','凝光','行秋','香菱','北斗','重云','辛焱','烟绯','云堇','瑶瑶','嘉明','早柚','托马','九条裟罗','五郎','久岐忍','鹿野院平藏','绮良良','卡维','柯莱','多莉','坎蒂丝','莱依拉','珐露珊','赛索斯','琳妮特','菲米尼','夏洛蒂','夏沃蕾','希格雯','艾梅莉埃','玛拉妮','茜特菈莉','欧洛伦','卡齐娜','伊安珊','伊法'] },
  T4: { label:'末线', desc:'使用率较低', color:'#7a7a8a',
        chars:['白术','闲云','七七','申鹤'] }
};

export const TALENT_BOOKS = {
  '自由':{region:'蒙德',color:'#74c2a8',days:[1,4]}, '抗争':{region:'蒙德',color:'#74c2a8',days:[2,5]}, '诗文':{region:'蒙德',color:'#74c2a8',days:[3,6]},
  '繁荣':{region:'璃月',color:'#e5b536',days:[1,4]}, '勤劳':{region:'璃月',color:'#e5b536',days:[2,5]}, '黄金':{region:'璃月',color:'#e5b536',days:[3,6]},
  '浮世':{region:'稻妻',color:'#b47ee8',days:[1,4]}, '风雅':{region:'稻妻',color:'#b47ee8',days:[2,5]}, '天光':{region:'稻妻',color:'#b47ee8',days:[3,6]},
  '诤言':{region:'须弥',color:'#8bc34a',days:[1,4]}, '巧思':{region:'须弥',color:'#8bc34a',days:[2,5]}, '笃行':{region:'须弥',color:'#8bc34a',days:[3,6]},
  '公平':{region:'枫丹',color:'#4fc3f7',days:[1,4]}, '正义':{region:'枫丹',color:'#4fc3f7',days:[2,5]}, '秩序':{region:'枫丹',color:'#4fc3f7',days:[3,6]},
  '焚燔':{region:'纳塔',color:'#ff7043',days:[1,4]}, '谵妄':{region:'纳塔',color:'#ff7043',days:[2,5]}, '冲突':{region:'纳塔',color:'#ff7043',days:[3,6]},
  '月光':{region:'诺德卡莱',color:'#81d4fa',days:[1,4]}, '极光':{region:'诺德卡莱',color:'#81d4fa',days:[2,5]}, '霜华':{region:'诺德卡莱',color:'#81d4fa',days:[3,6]}
};

export const TALENT_COST = {
  '6-6-6':   { 教导:9, 指引:63, 哲学:0,   摩拉:1262500 },
  '8-8-8':   { 教导:9, 指引:63, 哲学:0,   摩拉:1262500 },
  '9-9-9':   { 教导:9, 指引:63, 哲学:9,   摩拉:3562500 },
  '10-10-10':{ 教导:9, 指引:63, 哲学:114, 摩拉:4957500 }
};

export const WEAPON_BREAK_MATS = {
  '单手剑':{domain:'塞西莉亚苗圃',days:[1,4]}, '双手剑':{domain:'塞西莉亚苗圃',days:[1,4]},
  '长枪':{domain:'塞西莉亚苗圃',days:[1,4]}, '弓':{domain:'塞西莉亚苗圃',days:[1,4]},
  '法器':{domain:'塞西莉亚苗圃',days:[1,4]}
};

export const ARTIFACT_DOMAINS = {
  '炽烈的炎之魔女':{domain:'无妄引咎密宫',region:'璃月'}, '冰风迷途的勇士':{domain:'山脊守望',region:'蒙德'},
  '沉沦之心':{domain:'砂流之庭',region:'稻妻'}, '翠绿之影':{domain:'铭记之谷',region:'蒙德'},
  '悠古的磐岩':{domain:'孤云凌霄之处',region:'璃月'}, '如雷的盛怒':{domain:'雷音权现',region:'稻妻'},
  '深林的记忆':{domain:'缘觉塔',region:'须弥'}, '饰金之梦':{domain:'赤金的城墟',region:'须弥'},
  '绝缘之旗印':{domain:'椛染之庭',region:'稻妻'}, '追忆之注连':{domain:'椛染之庭',region:'稻妻'},
  '角斗士的终幕礼':{domain:'世界Boss掉落',region:'通用'}, '流浪大地的乐团':{domain:'世界Boss掉落',region:'通用'},
  '黄金剧团':{domain:'罪祸的终末',region:'枫丹'}, '逐影猎人':{domain:'罪祸的终末',region:'枫丹'},
  '千岩牢固':{domain:'孤云凌霄之处',region:'璃月'}, '苍白之火':{domain:'山脊守望',region:'蒙德'},
  '华馆梦醒形骸记':{domain:'槃荒之底',region:'稻妻'}, '辰砂往生录':{domain:'槃荒之底',region:'稻妻'},
  '来歆余响':{domain:'岩中幽谷',region:'璃月'}, '沙上楼阁史话':{domain:'缘觉塔',region:'须弥'},
  '水仙之梦':{domain:'熔铁的孤塞',region:'枫丹'}, '花海甘露之光':{domain:'熔铁的孤塞',region:'枫丹'},
  '谐律异想断章':{domain:'苍白的遗荣',region:'枫丹'}, '未竟的遐思':{domain:'苍白的遗荣',region:'枫丹'},
  '回声之林夜话':{domain:'深古瞭望所',region:'纳塔'}, '昔时之歌':{domain:'深古瞭望所',region:'纳塔'},
  '烬城勇者绘卷':{domain:'虹灵的净土',region:'纳塔'}, '黑曜秘典':{domain:'虹灵的净土',region:'纳塔'},
  '长夜之誓':{domain:'霜凝的旧日之厅',region:'诺德卡莱'}, '乐园遗落之花':{domain:'赤金的城墟',region:'须弥'}
};

// 武器池定轨配置
export const WEAPON_EPITOMIZED = {
  fatePointsMax: 2,       // 定轨命定值上限
  hardPity: 80            // 80 抽必出 5★ 武器
};



console.log('%c📦 扩展数据已加载', 'color:#d4af37;font-weight:bold;');