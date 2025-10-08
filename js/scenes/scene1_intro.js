import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { typeSfx } from '../core/typeSfx.js';

/**
 * Scene1Intro
 * 第一幕：纯分支视觉小说（无任何隐藏数值 / 好感度 / 进度条）
 * 设计原则：
 *  - “脚本驱动”：所有剧情行与分支按钮全部来源于外部 JSON（data/scene1_script.json）
 *  - “最小内核”：只有【行播放 → 行播完显示分支 → 选择跳转阶段】三件事
 *  - “无副作用状态”：不在内部累计数值；仅预留 this.tags 供未来可选扩展
 *  - “可热更新脚本”：追加 Date.now() 防缓存，便于直接刷新调试脚本
 *  - “可读性优先”：打字机 + 说话人徽标 + 移动端点击兼容
 *
 * 扩展点预留：
 *  - 标签：choice 可在未来扩展 tagsAdd 字段写入 this.tags
 *  - 语速：可在脚本行级添加 typingSpeed 覆盖全局 typingSpeed
 *  - 条件分支：未来可在渲染 choices 前过滤 requireTags / excludeTags
 */
export class Scene1Intro extends BaseScene {
  async enter(){
    const el=document.createElement('div');
    el.className='scene scene-intro';
    el.innerHTML=`
      <h1 class='intro-title'>穿越回高中</h1>
      <div class='vn-wrapper'>
        <div class='vn-box'>
          <div class='vn-speaker left hidden'></div>
          <div class='vn-speaker right hidden'></div>
          <div class='vn-text'></div>
        </div>
        <div class='choices dynamic-choices'></div>
      </div>
      <div style="display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; margin-top:.5rem;">
        <div class='phase-msg' data-phase='start'>回忆缓冲中...</div>
        <button class='bgm-btn intro-bgm' title='好听的音乐' style='margin-left:auto;'>♪</button>
      </div>
      <div class='title-egg hidden'></div>
    `;

  // 状态变量
  this.tags=new Set();
  this.titleClicks=0; this._titleBonusGiven=false;

    // 引用
  // 已移除 vnBox 直接引用（保留 DOM 结构即可）
    const vnText=el.querySelector('.vn-text');
    const speakerLeft=el.querySelector('.vn-speaker.left');
    const speakerRight=el.querySelector('.vn-speaker.right');
    const choicesBox=el.querySelector('.dynamic-choices');
    const phaseMsg=el.querySelector('.phase-msg');
    const bgmBtn=el.querySelector('.intro-bgm');
    const titleEgg=el.querySelector('.title-egg');
    const title=el.querySelector('.intro-title');

    // BGM
    const bgmAudio=audioManager.playSceneBGM('1',{loop:true,volume:0.55,fadeIn:900});
    bgmBtn.addEventListener('click',()=>{
      if(bgmAudio && bgmAudio.paused){ bgmAudio.play().catch(()=>{}); audioManager.globalMuted=false; bgmAudio.muted=false; bgmBtn.classList.remove('muted'); return; }
      const muted=audioManager.toggleMute(); bgmBtn.classList.toggle('muted',muted);
    });

  // 旧“锁定/解锁”逻辑已废弃：不需要 refreshChoiceLockStates

  // ---------------------------
  // 载入外部脚本（失败则回退到最小兜底）
  // ---------------------------
    let script=null; try{ const resp=await fetch('./data/scene1_script.json?_='+Date.now()); if(resp.ok) script=await resp.json(); }catch(e){}
    if(!script || !Array.isArray(script.stages)) script={stages:[{id:'intro',lines:[{speaker:'system',text:'脚本加载失败，使用兜底。'}]}]};

    const findStage=id=>script.stages.find(s=>s.id===id);
    let lineQueue=[];     // 当前阶段行数组
    let lineIndex=0;      // 下一待渲染的行索引
    let stageDoneCallback=null; // 阶段全部行显示完后的回调
    let awaitingLine=false;     // 防止并发推进

    // ---------------------------
    // 打字机状态与参数
    // ---------------------------
    let isTyping=false;          // 是否正在逐字播放
    let typingTimer=null;        // setInterval 句柄
    let currentFullText='';      // 本行完整文本
    let typingIndex=0;           // 已展示字符数
    const typingSpeed=34;        // ms / char (可按体验快慢调)
    let sfxCharCounter=0;        // 每两个有效字符触发一次敲击音，减少噪点
    const finishTyping=()=>{ if(typingTimer){ clearInterval(typingTimer); typingTimer=null; } isTyping=false; vnText.textContent=currentFullText; };
    const startTyping=(text)=>{
      finishTyping(); // 清理上一次
      currentFullText=text||''; typingIndex=0; vnText.textContent='';
      if(!currentFullText){ isTyping=false; return; }
      isTyping=true;
      typingTimer=setInterval(()=>{
        typingIndex++;
        const ch = currentFullText.charAt(typingIndex-1);
        vnText.textContent=currentFullText.slice(0,typingIndex);
        // 判定字符是否需要声音: 中英文/数字，跳过标点和空格
        if(/[\u4e00-\u9fa5A-Za-z0-9]/.test(ch)){
          sfxCharCounter++;
          if(sfxCharCounter>=2){ // 每两个有效字符响一次，减少噪点
            sfxCharCounter=0;
            if(!audioManager.globalMuted && typeSfx.isEnabled()){
              typeSfx.play();
            }
          }
        }
        if(typingIndex>=currentFullText.length){ finishTyping(); }
      }, typingSpeed);
    };
  /**
   * 更新对话框上方“说话人”徽标
   * 规则：
   *  - me: 左侧粉色
   *  - her: 右侧（人物）
   *  - system: 右侧系统色
   */
  const updateSpeaker=(speaker)=>{
      // 规格化，防止脚本里出现尾随空格或大小写差异
      if(typeof speaker==='string') speaker=speaker.trim().toLowerCase();
      const map={me:'我',her:'她',system:'系统'}; const label=map[speaker]??speaker;
      // 先清除颜色类
      [speakerLeft,speakerRight].forEach(el=>{ el.classList.remove('speaker-me','speaker-her','speaker-system'); });
      if(speaker==='me'){
        speakerLeft.textContent=label; speakerLeft.classList.remove('hidden'); speakerLeft.classList.add('speaker-me');
        speakerRight.classList.add('hidden');
      } else if(speaker==='her'){
        speakerRight.textContent=label; speakerRight.classList.remove('hidden'); speakerRight.classList.add('speaker-her');
        speakerLeft.classList.add('hidden');
      } else if(speaker==='system'){
        speakerRight.textContent=label; speakerRight.classList.remove('hidden'); speakerRight.classList.add('speaker-system');
        speakerLeft.classList.add('hidden');
      } 
    };
  /**
   * 推进到下一行：
   *  - 若仍在打字：先补完当前行（直接填充全文）
   *  - 若行队列已空：触发阶段完成回调 → 渲染分支或转场
   */
  const renderNextLine=()=>{
      if(awaitingLine) return;
      if(isTyping){ // 若仍在打字，先直接补完当前再返回
        finishTyping();
        return;
      }
      if(lineIndex>=lineQueue.length){
        // 所有行已显示完；确保不在打字状态后调用回调
        if(!isTyping){
          speakerLeft.classList.add('hidden');
          speakerRight.classList.add('hidden');
          if(stageDoneCallback) stageDoneCallback();
        }
        return;
      }
      awaitingLine=true;
      const l=lineQueue[lineIndex++];
      updateSpeaker(l.speaker);
      vnText.classList.remove('flash-line');
      void vnText.offsetWidth; // 重排重新触发动画
      startTyping(l.text);
      vnText.classList.add('flash-line');
      awaitingLine=false;
    };
    /**
     * 进入一个阶段：
     *  - 复制其 lines
     *  - 重置索引
     *  - 设置阶段完成回调
     */
    const appendLinesProgressively=(stage,done)=>{ lineQueue=(stage&&stage.lines)?[...stage.lines]:[]; lineIndex=0; stageDoneCallback=done; awaitingLine=false; vnText.textContent=''; renderNextLine(); };

    // （历史遗留说明）旧的“基于隐藏数值自动跳转”系统已彻底移除。

  /**
   * 阶段是否包含终结：有则触发转场到下一场景。
   * end: { next: 'exam' }
   */
  const endStage=stage=>{ if(stage.end){ const nextScene=stage.end.next||'exam'; phaseMsg.textContent='……'; setTimeout(()=>this.ctx.go('transition',{next:nextScene,style:'flash12'}),700); return true; } return false; };

    /**
     * 渲染当前阶段分支按钮；无 choices 时直接返回等待推进或结束。
     */
    const renderChoices=stage=>{
      choicesBox.innerHTML='';
      if(!stage.choices || !stage.choices.length){ return; }
      stage.choices.forEach(choice=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.textContent=choice.text||'...';
        if(choice.goto) btn.dataset.goto = choice.goto;
        // 保留 click 以兼容桌面；移动端采用 pointer 事件委托，避免某些浏览器 click 延迟 / 丢失
        btn.addEventListener('click', (e)=>{
          const targetGoto = e.currentTarget.dataset.goto; if(targetGoto) goStage(targetGoto);
        });
        choicesBox.appendChild(btn);
      });
      refreshChoiceLockStates();
    };

  // 移动端偶发 click 不触发：增加 pointerup / touchend 兜底（防某些 WebView 丢失 click）
    const choiceTapHandler = (e)=>{
      const btn = e.target.closest('button[data-goto]');
      if(!btn || !choicesBox.contains(btn)) return;
      // 避免同时触发 click 与 pointerup 导致重复跳转：使用节流标记
      if(btn._tapHandledAt && performance.now() - btn._tapHandledAt < 300) return;
      btn._tapHandledAt = performance.now();
      const to = btn.dataset.goto; if(to) goStage(to);
    };
    choicesBox.addEventListener('pointerup', choiceTapHandler, { passive:true });
    choicesBox.addEventListener('touchend', choiceTapHandler, { passive:true });

  /**
   * 跳转阶段：装入 lines → 播放；若阶段含 end 则走转场；否则渲染 choices。
   */
  const goStage=id=>{ const st=findStage(id); if(!st) return; this.currentStage=st; appendLinesProgressively(st,()=>{ if(endStage(st)) return; renderChoices(st); }); };

    // 推进事件：空格或点击空白区域
  /**
   * 空白推进 / 空格键推进：
   *  - 忽略点击在分支按钮上
   *  - 首次交互预热 WebAudio（typeSfx）
   *  - 打字中：直接补完
   *  - 否则：进入下一行
   */
  const advanceHandler=(e)=>{
      // 避免点击选项按钮触发推进
      if(e && e.target && e.target.tagName==='BUTTON' && e.target.closest('.dynamic-choices')) return;
      // 首次交互预热音频上下文（iOS Safari）
      if(!this._typedOnce){ this._typedOnce=true; typeSfx.warm(); }
      // 情况1：正在打字 -> 立即补完
      if(isTyping){ finishTyping(); return; }
      // 情况2：已打完当前行 -> 进入下一行或阶段回调
      renderNextLine();
    };
    window.addEventListener('keydown', (e)=>{ if(e.code==='Space'){ e.preventDefault(); advanceHandler(e); } });
    el.addEventListener('click', advanceHandler);

    // 标题点击彩蛋：第 6 次出现提示；第 10 次给隐藏文案，仅一次
    title.addEventListener('click',()=>{ this.titleClicks++; if(this.titleClicks===6){ titleEgg.textContent='（再点几下也许会有点什么~）'; titleEgg.classList.remove('hidden'); } if(this.titleClicks===10 && !this._titleBonusGiven){ this._titleBonusGiven=true; titleEgg.textContent='（给你一个看不见的勇气 buff！）'; }});

    goStage('intro');
    this.ctx.rootEl.appendChild(el);
  }

  async exit(){ 
    // 退出场景：使用与播放相同的 key '1' 做淡出，避免残留
    audioManager.stopBGM('1',{fadeOut:600}); 
  }
}
