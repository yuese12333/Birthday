import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

/**
 * 场景5 重构：卡牌多关组合系统
 * 设计目标：
 *  - 将“看话剧”与“点餐”抽象为卡牌（show/food/drink 类型 + 特性 tag）。
 *  - 每一关有不同“目标提示”（例如：温柔+甜、清爽+轻食、暖心+陪伴）。
 *  - 玩家在限定数量内选牌→计算基础分 + 协同加成（synergy）。
 *  - 协同判定：满足提示关键词组合（tag 交集）或专属组合表；即时飘出 synergy 氛围提示。
 *  - 最终汇总各关得分 → 给出气氛匹配评价，进入下一场景。
 */
export class Scene5Date extends BaseScene {
  async init(){
    await super.init();
    /** 基础卡池：可以后续扩展 / 从外部 JSON 载入 */
    this.cards = [
      { id:'show_soft', title:'话剧 · 治愈系对白', base:2, tags:['soft','healing','show'], type:'show', hint:'温柔对白' },
      { id:'show_comedy', title:'话剧 · 轻喜剧笑点', base:1, tags:['fun','light','show'], type:'show', hint:'欢笑舒缓' },
      { id:'show_deep', title:'话剧 · 情绪共鸣本', base:3, tags:['deep','tear','show'], type:'show', hint:'容易代入' },
      { id:'food_pasta', title:'餐点 · 奶油意面', base:2, tags:['soft','warm','food'], type:'food', hint:'顺滑柔软' },
      { id:'food_spicy', title:'餐点 · 微辣创意', base:1, tags:['spicy','stim','food'], type:'food', hint:'一点火花' },
      { id:'food_dessert', title:'餐点 · 心形慕斯', base:3, tags:['sweet','romance','food'], type:'food', hint:'仪式甜感' },
      { id:'drink_orange', title:'饮品 · 橙子气泡', base:1, tags:['fresh','citrus','drink'], type:'drink', hint:'清爽提神' },
      { id:'drink_milk', title:'饮品 · 温牛奶', base:2, tags:['warm','soft','drink'], type:'drink', hint:'安抚柔和' },
      { id:'drink_rose', title:'饮品 · 玫瑰花茶', base:2, tags:['aroma','romance','drink'], type:'drink', hint:'淡香浪漫' }
    ];

    /** 关卡配置：targetTags 代表本关鼓励的氛围关键词；limit 为选择数量范围 */
    this.levels = [
      { id:1, title:'第一关 · 轻松破冰', tip:'想要：轻松 + 温柔', targetTags:['light','soft'], pick:[2,3] },
      { id:2, title:'第二关 · 甜甜升温', tip:'想要：甜感 + 仪式感', targetTags:['sweet','romance'], pick:[2,3] },
      { id:3, title:'第三关 · 暖心陪伴', tip:'想要：治愈 + 温暖', targetTags:['healing','warm','soft'], pick:[3,4] }
    ];
    /** 特殊协同组合（不看 targetTags），出现即额外加分 synergyBonus */
    this.specialSynergies = [
      { ids:['show_soft','food_dessert','drink_rose'], bonus:3, label:'玫瑰柔情套餐' },
      { ids:['show_comedy','food_spicy','drink_orange'], bonus:2, label:'活力笑点组合' },
      { ids:['show_deep','food_pasta','drink_milk'], bonus:2, label:'抱抱疗愈局' }
    ];
    this.currentLevelIndex = 0;
    this.levelScores = []; // 存每一关 {base, targetMatch, synergy, total}
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
    const bgmAudio = audioManager.playBGM('scene5','./assets/audio/scene_5.mp3',{ loop:true, volume:0.6, fadeIn:900 });
    bgmBtn.addEventListener('click',()=>{
      if(bgmAudio && bgmAudio.paused){
        const p = bgmAudio.play(); if(p) p.catch(()=>{});
        audioManager.globalMuted = false; bgmAudio.muted=false; bgmBtn.classList.remove('muted'); return;
      }
      const muted = audioManager.toggleMute();
      bgmBtn.classList.toggle('muted', muted);
    });

    const currentLevel = () => this.levels[this.currentLevelIndex];

    const updateLevelInfo = () => {
      const lv = currentLevel();
      levelInfo.textContent = `${lv.title} ｜ 提示：${lv.tip}`;
      limitHint.textContent = `需要选择 ${lv.pick[0]}~${lv.pick[1]} 张卡牌`;
    };

    const renderCards = () => {
      grid.innerHTML='';
      this.cards.forEach(card=>{
        const div = document.createElement('div');
        div.className='card';
        div.dataset.id = card.id;
        div.innerHTML = `
          <div class='title'>${card.title}</div>
          <div class='tags'>${card.tags.map(t=>`<span class='tag ${t.startsWith('show')?'type-show': t==='sweet'||t==='romance'?'':'${'}'></span>`).join('')}</div>`;
        // 简化：重新构造 tags HTML（上面模板故意留空，避免嵌套复杂判断字符串转义问题）
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

    const refreshSelectionUI = ()=>{
      chosenList.innerHTML='';
      this.selected.forEach(id=>{
        const card = this.cards.find(c=>c.id===id);
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

    const calcScore = ()=>{
      const lv = currentLevel();
      const picked = Array.from(this.selected).map(id=> this.cards.find(c=>c.id===id));
      let base = picked.reduce((a,c)=> a + c.base,0);
      // 目标标签匹配：统计出现的 targetTags
      const tagSet = new Set(picked.flatMap(c=>c.tags));
      let targetMatch = 0;
      lv.targetTags.forEach(t=>{ if(tagSet.has(t)) targetMatch++; });
      const targetBonus = targetMatch; // 每命中1个加1分
      // 特殊协同
      let synergyBonus = 0; let synergyLabel='';
      this.specialSynergies.forEach(syn=>{
        if(syn.ids.every(id=> this.selected.has(id))){
          synergyBonus += syn.bonus; synergyLabel += (synergyLabel?' / ':'') + syn.label;
        }
      });
      if(synergyBonus>0) showSynergyPop(`协同! +${synergyBonus} (${synergyLabel})`);
      // 通用协同（满足≥2个 targetTags 且包含 romace/sweet 之一再+1）
      if(targetMatch >=2 && (tagSet.has('romance')||tagSet.has('sweet'))){
        synergyBonus += 1; showSynergyPop('氛围升温 +1');
      }
      const total = base + targetBonus + synergyBonus;
      return {base, targetBonus, synergyBonus, total, synergyLabel};
    };

    const lockCards = ()=>{
      this.levelResolved = true;
      grid.querySelectorAll('.card').forEach(c=> c.classList.add('locked'));
    };

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

    resetBtn.addEventListener('click',()=>{
      if(this.levelResolved) return; // 结算后不可重置
      this.selected.clear();
      grid.querySelectorAll('.card').forEach(c=> c.classList.remove('selected'));
      refreshSelectionUI();
    });

    nextBtn.addEventListener('click',()=>{
      this.currentLevelIndex++;
      this.selected.clear(); this.levelResolved = false;
      nextBtn.classList.add('hidden'); scoreBox.textContent='';
      grid.innerHTML='';
      renderCards(); updateLevelInfo(); refreshSelectionUI();
    });

    finalBtn.addEventListener('click',()=>{
      // 汇总
      const total = this.levelScores.reduce((a,s)=> a + s.total,0);
      const maxTheoretical =  (/*粗略*/  (2+3+2) + (2+3+3) + (3+3+2)); // 只是示意：可改成动态求
      let evalText = '';
      if(total >= maxTheoretical * 0.8) evalText = '我们简直是氛围导演！';
      else if(total >= maxTheoretical * 0.6) evalText = '默契在线，随手就是对味组合~';
      else evalText = '组合独特，可爱即正义。';
      summaryContainer.innerHTML = `
        <div class='summary-card'>
          <h3>组合旅程总结</h3>
          <p>关卡数：${this.levels.length}</p>
          <p>总得分：${total}</p>
          <p>${evalText}</p>
        </div>`;
      finalBtn.disabled = true;
      setTimeout(()=> this.ctx.go('scarf'), 900);
    });

    // 初始渲染
    renderCards(); updateLevelInfo(); refreshSelectionUI();
    this.ctx.rootEl.appendChild(el);
  }
  async exit(){
    audioManager.stopBGM('scene5',{ fadeOut:650 });
  }
}
