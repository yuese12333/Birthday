import { BaseScene } from '../core/baseScene.js';

/**
 * 场景1：高中安抚扩展玩法
 * 新增特性：
 *  - 情感类别 + 组合（不同正向类别累积 2 / 3 种 -> 额外加成）
 *  - 情绪泡泡飘字反馈
 *  - 标题点击彩蛋：7 次提示，10 次+5 安抚值（一次性）
 *  - 快捷“抱紧”按钮：达到 50% 目标值出现，可直接跳过剩余补足
 *  - 负向柔化：连续负向减弱，第三次触发救援加正分
 *  - 阶段语：根据安抚进度区间显示动态鼓励语
 *  - 冷启动：前 2 秒按钮禁用，显示“回忆缓冲”
 */
export class Scene1Intro extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-intro';
    el.innerHTML = `
      <h1 class='intro-title'>穿越回高中</h1>
      <p>我：为了给你准备一个最特别的生日礼物，我竟然……时空裂开了！</p>
      <p>她（过去）：……（看起来有点紧张）</p>
      <div class="phase-msg" data-phase="start">回忆缓冲中...</div>
      <div class="choices disabled">
        <button data-mood="+15" data-cat="comfort">“别怕，我来陪你，一切都会好的。”</button>
        <button data-mood="+10" data-cat="encourage">“你已经很棒了，现在我在。”</button>
        <button data-mood="+8" data-cat="companion">“不急，我们慢慢来，我先陪你走一圈。”</button>
        <button data-mood="+5" data-cat="comfort">“先深呼吸，给你一个拥抱。”</button>
        <button data-mood="-5" data-cat="awkward">“要不我们先写作业？”</button>
      </div>
      <div class="mood-wrapper">
        <div class="progress-line">安抚值 <span class='val'>0</span> / <span class='tar'>30</span> <span class='combo-badge hidden'></span></div>
        <div class="mood-bar"><span class="fill"></span></div>
      </div>
  <div class='fast-next hidden' data-debounce='800'>“我现在就抱紧你”</div>
      <div class='title-egg hidden'></div>
    `;
    this.mood = 0;
    this.target = 30;
    this.comboSet = new Set();
    this.consecutiveNegative = 0;
    this.highestCombo = 1;
    this.titleClicks = 0;
    this._titleBonusGiven = false;
    const fill = el.querySelector('.fill');
    const valEl = el.querySelector('.val');
    const comboBadge = el.querySelector('.combo-badge');
    const phaseMsg = el.querySelector('.phase-msg');
    const fastNext = el.querySelector('.fast-next');
    const titleEgg = el.querySelector('.title-egg');
    const choicesBox = el.querySelector('.choices');

    // 冷启动 2 秒
    const unlockAt = Date.now() + 2000;
    const unlockTimer = setInterval(()=>{
      if(Date.now() >= unlockAt){
        clearInterval(unlockTimer);
        choicesBox.classList.remove('disabled');
        phaseMsg.textContent = '她需要你的温柔陪伴';
      }
    }, 100);

    const phaseTexts = [
      { max:0.3, text:'她还很紧张，先用温柔安慰。' },
      { max:0.6, text:'她慢慢放松，继续保持多样陪伴。' },
      { max:1.0, text:'再一点点，她就会完全安心。' }
    ];

    const updatePhase = () => {
      const r = this.mood / this.target;
      const found = phaseTexts.find(p=> r <= p.max);
      if(found) phaseMsg.textContent = found.text;
    };

    const updateProgress = ()=>{
      const ratio = Math.min(1,this.mood/this.target);
      fill.style.width = (ratio*100)+'%';
      valEl.textContent = this.mood;
      updatePhase();
      if(ratio >= 0.5 && fastNext.classList.contains('hidden')){
        fastNext.classList.remove('hidden');
        fastNext.classList.add('pop-in');
        setTimeout(()=> fastNext.classList.remove('pop-in'),600);
      }
    };

    const spawnBubble = (btn, text, cls='')=>{
      const rect = btn.getBoundingClientRect();
      const bubble = document.createElement('div');
      bubble.className = 'mood-bubble '+cls;
      bubble.textContent = text;
      // 位置用 viewport 然后以 fixed/absolute 处理，这里用 absolute 附着在按钮父级
      bubble.style.left = (rect.left + rect.width/2 + window.scrollX)+'px';
      bubble.style.top = (rect.top + window.scrollY - 10)+'px';
      document.body.appendChild(bubble);
      requestAnimationFrame(()=> bubble.classList.add('rise'));
      setTimeout(()=> bubble.remove(), 1200);
    };

    const applyMood = (baseDelta, category, btn)=>{
      let delta = baseDelta;
      // 负向柔化
      if(delta < 0){
        this.consecutiveNegative++;
        if(this.consecutiveNegative === 2){ delta = Math.min(-2, delta); }
        else if(this.consecutiveNegative >= 3){
          // 触发救援：停止负向，给正向反弹
            this.consecutiveNegative = 0;
            delta = +8;
            spawnBubble(btn, '+8', 'rescue');
            phaseMsg.textContent = '不管你说什么，我都抱紧你。';
        }
      } else {
        // 正向，处理 combo
        this.consecutiveNegative = 0;
        const beforeSize = this.comboSet.size;
        this.comboSet.add(category);
        const afterSize = this.comboSet.size;
        if(afterSize > beforeSize){
          // 新增不同类别
          if(afterSize === 2){ delta += 2; spawnBubble(btn,'多样+2','combo'); }
          if(afterSize === 3){ delta += 4; spawnBubble(btn,'多样+4','combo-strong'); }
          this.highestCombo = Math.max(this.highestCombo, afterSize);
        }
        // 若用户重复单一类别不加成
        // 当本题正向后可考虑重置策略：保持现状允许继续扩展（如未来增加第4类）
      }
      this.mood += delta;
      if(this.mood < 0) this.mood = 0;
      if(this.mood > this.target) this.mood = this.target; // 上限封顶
      updateProgress();
      if(delta !== 0) spawnBubble(btn, (delta>0?'+':'')+delta, delta>0?'pos':'neg');

      // combo 徽章视觉
      const comboLevel = this.comboSet.size;
      if(comboLevel >= 2){
        comboBadge.textContent = '多样陪伴 x'+comboLevel;
        comboBadge.classList.remove('hidden');
        comboBadge.classList.add('flash');
        setTimeout(()=> comboBadge.classList.remove('flash'),500);
      }
      if(this.mood >= this.target){
        if(this._toExam) return; // 防抖
        this._toExam = true;
        choicesBox.querySelectorAll('button').forEach(b=> b.disabled = true);
        phaseMsg.textContent = '她安心地点了点头...';
        setTimeout(()=> this.ctx.go('exam'), 500);
      }
    };

    // 按钮绑定
    choicesBox.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(choicesBox.classList.contains('disabled')) return; // 冷启动期
        const delta = parseInt(btn.dataset.mood,10);
        const cat = btn.dataset.cat || 'misc';
        applyMood(delta, cat, btn);
        if(delta < 0){
          btn.classList.add('shake');
          setTimeout(()=> btn.classList.remove('shake'),500);
        }
      });
    });

    // 快捷抱紧按钮
    fastNext.addEventListener('click',()=>{
      if(this.mood >= this.target) return;
      phaseMsg.textContent = '抱紧中…';
      this.mood = this.target;
      updateProgress();
      spawnBubble(fastNext, '+抱紧', 'fast');
      if(!this._toExam){
        this._toExam = true;
        setTimeout(()=> this.ctx.go('exam'), 600);
      }
    });

    // 标题彩蛋
    const title = el.querySelector('.intro-title');
    title.addEventListener('click',()=>{
      this.titleClicks++;
      if(this.titleClicks === 7){
        titleEgg.textContent = '（你在找彩蛋吗？再点几下~）';
        titleEgg.classList.remove('hidden');
      }
      if(this.titleClicks === 10 && !this._titleBonusGiven){
        this._titleBonusGiven = true;
        spawnBubble(title,'+5','egg');
        this.mood = Math.min(this.target, this.mood + 5);
        updateProgress();
      }
    });

    updateProgress();
    this.ctx.rootEl.appendChild(el);
  }
}
