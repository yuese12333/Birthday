import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * Scene5Date —— “第一次约会” 多关卡卡牌组合玩法
 * --------------------------------------------------------------------
 * 设计目标（本次重构核心）：
 *  1. 数据外部化：所有关卡（levels）、卡牌（cards）、协同规则（synergyRules）由
 *     ./data/scene5_levels.json 提供；代码仅做驱动与评分，不写死业务内容。
 *  2. 可塑性：不同关可以拥有完全不同的卡牌集合 / 选择数量区间 / 目标标签。
 *  3. 协同引擎抽象：统一遍历 rule 列表执行，当前内置：
 *        - type: 'set'     固定卡牌 id 全部被选中触发
 *        - type: 'tagCombo' 标签组合（all=true 需全含，否则任意命中即可）
 *     预留扩展：ratio / sequence / pairPrefer / avoidConflict ...
 *  4. 评分拆解：{ base, targetBonus, synergyBonus, total, ruleHits[] } 便于后续展示或成就统计。
 *  5. 失败兜底：若外部 JSON 加载失败，提供最小 fallback 关卡，避免流程断裂。
 *
 * 外部 JSON 约定（简化示例）：
 *  {
 *    "levels":[{
 *      "id":1,
 *      "title":"第一关 · 轻松破冰",
 *      "tip":"想要：轻松 + 温柔",
 *      "pick":[2,3],                // [min,max]
 *      "targetTags":["light","soft"],
 *      "cards":[ {"id":"show_soft","title":"…","base":2,"tags":["soft","show"],"hint":"…"} ],
 *      "synergyRules":[
 *         {"type":"set","ids":["show_soft","drink_milk"],"bonus":2,"label":"柔声与温奶"},
 *         {"type":"tagCombo","tags":["sweet","romance"],"all":false,"bonus":1,"label":"甜意点缀"}
 *      ]
 *    }]
 *  }
 *
 * 核心内部状态：
 *    this.levels[]                // 外部载入
 *    this.currentLevelIndex       // 当前关索引
 *    this.selected: Set<cardId>   // 当前关已选择卡牌
 *    this.levelScores[]           // 各关评分结果（按顺序 push）
 *    this.levelResolved:boolean   // 是否已结算本关
 *
 * 扩展指引：
 *  - 新增规则：在 calcScore rules.forEach 分支里添加新 type；或抽出独立函数映射表。
 *  - 新增卡牌属性：直接在 JSON 中添加字段；渲染时在 renderCards 补展示（不影响评分）。
 *  - 自定义评价文案：当前在 final 汇总里用比例生成，可改成读取 data.meta.evaluationTable。
 *  - 记录最优组合：保存 this.levelScores 与对应 cardId 集合到 localStorage。
 */
export class Scene5Date extends BaseScene {
  async init(){
    await super.init();
    const resp = await fetch('./data/scene5_levels.json');
    if(!resp.ok) throw new Error('关卡配置加载失败: ' + resp.status);
    const data = await resp.json();
    if(!Array.isArray(data.levels)) throw new Error('关卡配置格式错误：levels 必须为数组');
    this.levels = data.levels;
    this.currentLevelIndex = 0;
    this.levelScores = [];
    this.selected = new Set();
  }

  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-date';
    el.innerHTML = `
      <h1>场景5：第一次正式约会 · 卡牌组合</h1>
      <div style="display:flex; gap:.8rem; align-items:center; flex-wrap:wrap; margin:.3rem 0 .4rem;">
        <div class='level-info'></div>
        <button class='bgm-btn date-bgm' title='好听的音乐' data-debounce style='margin-left:auto;'>♪</button>
      </div>
      <div class='card-grid'></div>
      <div class='chosen-panel'>
        <div>已选卡牌：<span class='count'>0</span></div>
        <div class='list'></div>
        <div class='limit-hint'></div>
      </div>
      <div class='actions'>
        <button class='calc' disabled data-debounce='600'>提交本关</button>
        <button class='reset' data-debounce='400'>重选</button>
      </div>
      <div class='score-box'></div>
      <button class='next-level-btn hidden' data-debounce='700'>进入下一关 →</button>
      <button class='final-btn hidden' data-debounce='800'>完成并继续旅程</button>
      <div class='summary-container'></div>
      <div class='synergy-pop'></div>
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    // ---- DOM 引用缓存 ----
    const levelInfo = el.querySelector('.level-info');
    const grid = el.querySelector('.card-grid');
    const chosenList = el.querySelector('.chosen-panel .list');
    const countEl = el.querySelector('.chosen-panel .count');
    const limitHint = el.querySelector('.chosen-panel .limit-hint');
    const calcBtn = el.querySelector('.calc');
    const resetBtn = el.querySelector('.reset');
    const scoreBox = el.querySelector('.score-box');
    const nextBtn = el.querySelector('.next-level-btn');
    const finalBtn = el.querySelector('.final-btn');
    const synergyPop = el.querySelector('.synergy-pop');
    const summaryContainer = el.querySelector('.summary-container');
    const bgmBtn = el.querySelector('.date-bgm');

    // 自动播放约会场景 BGM
    // 播放场景 BGM（key 统一用数字 '5'）
    const bgmAudio = audioManager.playSceneBGM('5',{ loop:true, volume:0.6, fadeIn:900 });
    bgmBtn.addEventListener('click',()=>{
      if(bgmAudio && bgmAudio.paused){
        const p = bgmAudio.play(); if(p) p.catch(()=>{});
        audioManager.globalMuted = false; bgmAudio.muted=false; bgmBtn.classList.remove('muted'); return;
      }
      const muted = audioManager.toggleMute();
      bgmBtn.classList.toggle('muted', muted);
    });

    // 工具函数：获取当前关配置
    const currentLevel = () => this.levels[this.currentLevelIndex];

    // 更新顶部关卡标题 & 选择限制提示
    const updateLevelInfo = () => {
      const lv = currentLevel();
      levelInfo.textContent = `${lv.title} ｜ 提示：${lv.tip}`;
      limitHint.textContent = `需要选择 ${lv.pick[0]}~${lv.pick[1]} 张卡牌`;
    };

    const renderCards = () => {
      grid.innerHTML='';
      const lv = currentLevel();
      (lv.cards||[]).forEach(card=>{
        const div = document.createElement('div');
        div.className='card';
        div.dataset.id = card.id;
        // 先写入标题，标签区域下方再动态补齐（避免复杂模板 & 转义问题）
        const tagsWrap = document.createElement('div');
        tagsWrap.className='tags';
        card.tags.forEach(t=>{
          const span = document.createElement('span');
          let cls='tag';
            if(t==='show'||t==='healing'||t==='fun'||t==='deep'||t==='tear'||t==='light') cls+=' type-show';
            if(['food','sweet','romance','spicy','stim','warm','soft'].includes(t)) cls+=' type-food';
            if(['drink','fresh','citrus','aroma'].includes(t)) cls+=' type-drink';
          span.className=cls;
          span.textContent=t;
          tagsWrap.appendChild(span);
        });
        const baseEl = document.createElement('div'); baseEl.className='base'; baseEl.textContent = `基础 ${card.base}`;
        const hintEl = document.createElement('div'); hintEl.className='hint'; hintEl.textContent = card.hint;
        div.innerHTML = `<div class='title'>${card.title}</div>`;
        div.appendChild(tagsWrap); div.appendChild(baseEl); div.appendChild(hintEl);
        div.addEventListener('click',()=>{
          if(div.classList.contains('locked')) return;
          if(this.levelResolved) return; // 当前关已结算
          const lv = currentLevel();
          if(this.selected.has(card.id)) this.selected.delete(card.id); else this.selected.add(card.id);
          div.classList.toggle('selected');
          refreshSelectionUI();
        });
        grid.appendChild(div);
      });
    };

    // 刷新“已选卡牌”侧边面板 + 计算按钮可用状态
    const refreshSelectionUI = ()=>{
      chosenList.innerHTML='';
      const lv = currentLevel();
      this.selected.forEach(id=>{
        const card = (lv.cards||[]).find(c=>c.id===id);
        const pill = document.createElement('span');
        pill.className='chosen-pill';
        pill.textContent = card.title.split('·')[1]?.trim() || card.title;
        chosenList.appendChild(pill);
      });
      countEl.textContent = this.selected.size;
      const [min,max] = currentLevel().pick;
      calcBtn.disabled = this.selected.size < min || this.selected.size > max;
    };

    const showSynergyPop = (text)=>{
      synergyPop.textContent = text;
      synergyPop.classList.add('show');
      setTimeout(()=> synergyPop.classList.remove('show'), 1300);
    };

    // 评分引擎：执行当前关卡协同规则
    // 评分核心：根据当前关卡配置与选中集合计算得分
    const calcScore = ()=>{
      const lv = currentLevel();
      const picked = Array.from(this.selected).map(id=> (lv.cards||[]).find(c=>c.id===id)).filter(Boolean);
      const tagSet = new Set(picked.flatMap(c=> c.tags));
      const base = picked.reduce((a,c)=> a + (c.base||0),0);
      // 目标标签 bonus：命中一个 +1
      const targetBonus = (lv.targetTags||[]).reduce((acc,t)=> acc + (tagSet.has(t)?1:0),0);
      let synergyBonus = 0; const ruleHits=[];
      const rules = Array.isArray(lv.synergyRules)? lv.synergyRules : [];
      rules.forEach(rule=>{
        if(rule.type==='set'){ // 固定 id 集合全部被选中
          const all = (rule.ids||[]).every(id=> this.selected.has(id));
          if(all){ synergyBonus += rule.bonus||0; ruleHits.push(rule.label||'set'); showSynergyPop(`${rule.label||'组合'} +${rule.bonus}`); }
        } else if(rule.type==='tagCombo'){ // 标签组合：all=true 需全部包含；否则任意一个即可（至少一个）
          const tags = rule.tags||[];
          const hasAll = tags.every(t=> tagSet.has(t));
            const hasAny = tags.some(t=> tagSet.has(t));
            const pass = rule.all ? hasAll : hasAny;
            if(pass){ synergyBonus += rule.bonus||0; ruleHits.push(rule.label||'tagCombo'); showSynergyPop(`${rule.label||'标签协同'} +${rule.bonus}`); }
        }
        // 预留：else if(rule.type==='ratio') {...}
      });
      const total = base + targetBonus + synergyBonus;
      return { base, targetBonus, synergyBonus, total, ruleHits };
    };

    // 关卡结算：锁定卡牌防止继续修改
    const lockCards = ()=>{
      this.levelResolved = true;
      grid.querySelectorAll('.card').forEach(c=> c.classList.add('locked'));
    };

    // “提交本关”点击：计算得分 & 展示下一步按钮
    calcBtn.addEventListener('click',()=>{
      if(calcBtn.disabled) return;
      const sc = calcScore();
      lockCards();
      this.levelScores.push(sc);
      scoreBox.innerHTML = `基础 ${sc.base} + 目标匹配 ${sc.targetBonus} + 协同 ${sc.synergyBonus} = <strong>${sc.total}</strong>`;
      const isLast = this.currentLevelIndex === this.levels.length -1;
      if(isLast){ finalBtn.classList.remove('hidden'); }
      else { nextBtn.classList.remove('hidden'); }
      const lvEnd = document.createElement('div'); lvEnd.className='level-end';
      lvEnd.textContent = '本关完成，随时可继续。';
      scoreBox.appendChild(lvEnd);
    });

    // 重选：仅在未结算时允许清空选择
    resetBtn.addEventListener('click',()=>{
      if(this.levelResolved) return; // 结算后不可重置
      this.selected.clear();
      grid.querySelectorAll('.card').forEach(c=> c.classList.remove('selected'));
      refreshSelectionUI();
    });

    // 进入下一关：重置临时状态
    nextBtn.addEventListener('click',()=>{
      this.currentLevelIndex++;
      this.selected.clear(); this.levelResolved = false;
      nextBtn.classList.add('hidden'); scoreBox.textContent=''; summaryContainer.textContent='';
      grid.innerHTML='';
      renderCards(); updateLevelInfo(); refreshSelectionUI();
    });

    // 最终汇总：估算理论最大（粗略）并给出评价
    finalBtn.addEventListener('click',()=>{
      const total = this.levelScores.reduce((a,s)=> a + s.total,0);
      // 动态粗略最大值估算：每关取其 cards 基础分 top N + targetTags 数量 + 所有规则 bonus
      const maxPerLevel = this.levels.map(lv=>{
        const pickMax = lv.pick? lv.pick[1] : (lv.cards||[]).length;
        const sorted = [...(lv.cards||[])].sort((a,b)=> (b.base||0)-(a.base||0)).slice(0,pickMax);
        const baseMax = sorted.reduce((a,c)=> a + (c.base||0),0);
        const tagMax = (lv.targetTags||[]).length; // 理论命中全部
        const ruleBonus = (lv.synergyRules||[]).reduce((a,r)=> a + (r.bonus||0),0); // 理论全部触发
        return baseMax + tagMax + ruleBonus;
      });
      const maxTheoretical = maxPerLevel.reduce((a,b)=>a+b,0) || 1;
      let ratio = total / maxTheoretical;
      let evalText = ratio>=0.8? '我们简直是氛围导演！' : ratio>=0.6? '默契在线，随手就是对味组合~' : '组合独特，可爱即正义。';
      summaryContainer.innerHTML = `
        <div class='summary-card'>
          <h3>组合旅程总结</h3>
          <p>关卡数：${this.levels.length}</p>
          <p>总得分：${total} / 理论约 ${maxTheoretical}</p>
          <p>${evalText}</p>
        </div>`;
      finalBtn.disabled = true;
      setTimeout(()=> this.ctx.go('scarf'), 900);
    });

    // 初始渲染
  // 初始渲染入口
  renderCards(); updateLevelInfo(); refreshSelectionUI();
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){
    audioManager.stopBGM('5',{ fadeOut:650 });
  }
}
