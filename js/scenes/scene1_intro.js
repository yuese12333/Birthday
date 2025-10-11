import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { typeSfx } from '../core/typeSfx.js';

// 若全局未提供 showOutcomeOverlay，这里给出一个最小可用的本地兜底实现
// 语义：返回一个 Promise，在用户点击“继续”按钮后 resolve
// 如果外部以后定义了 window.showOutcomeOverlay，会优先使用外部版本（保持可替换性）
const showOutcomeOverlay = (type)=>{
  try {
    if(typeof window !== 'undefined' && typeof window.showOutcomeOverlay === 'function'){
      return window.showOutcomeOverlay(type);
    }
  } catch(_e) { /* 忽略 window 访问异常（极少数环境）*/ }
  return new Promise(resolve=>{
    // 移除旧的
    const old=document.querySelector('.outcome-overlay-fallback');
    if(old) old.remove();
    const ov=document.createElement('div');
    ov.className='outcome-overlay-fallback';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);';
    const box=document.createElement('div');
    box.style.cssText='background:#fff;padding:1.4rem 1.6rem;max-width:340px;width:88%;border-radius:14px;box-shadow:0 6px 22px -4px rgba(0,0,0,.28);font-size:.95rem;line-height:1.55;animation:fadeScale .32s ease;';
    const isWin=type==='win';
    box.innerHTML=`<h2 style="margin:0 0 .75rem;font-size:1.25rem;color:${isWin?'#e91e63':'#3949ab'};text-align:center;">${isWin?'成功':'失败'}</h2>
      <p style='margin:.2rem 0 1rem;white-space:pre-line;'>${isWin? '她信了你一次。（可在脚本里自定义更走心的文字）':'这次没说服她，再试试别的说法吧。'}</p>
      <button class='outcome-continue' style='display:block;margin:0 auto;padding:.55rem 1.2rem;border-radius:999px;border:none;background:${isWin?'#ff4d84':'#5c6bc0'};color:#fff;font-size:.9rem;cursor:pointer;'>继续</button>`;
    ov.appendChild(box);
    document.body.appendChild(ov);
    const done=()=>{
      ov.style.opacity='0';
      ov.style.transition='opacity .22s';
      setTimeout(()=>{ ov.remove(); resolve(); },230);
    };
    box.querySelector('.outcome-continue').addEventListener('click',done);
    ov.addEventListener('click',e=>{ if(e.target===ov) done(); });
  });
};

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

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

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

    const resp=await fetch('./data/scene1_script.json?_='+Date.now());
    const script=await resp.json();

  // 构建映射提升检索 + 兼容任意顺序
  // JSON 设计说明：不强制 version>=3；当前脚本示例 version:1 也可运行。
  // 起始阶段不再硬编码必须存在 dialogue_0_1；若缺失则取第一条，增强脚本灵活性。
  const stageMap = new Map(script.stages.map(s=>[s.id,s]));
  const findStage=id=>stageMap.get(id);
    // === 精简版 dialogue_x_y & win/fail ===
    // 约定：id = dialogue_<failCount>_<seq>
    // fail 分支：跳到 dialogue_{failCount+1}_1
    const dialoguePattern = /^dialogue_(\d+)_([\w-]+)$/;
    const computeNextFailId = currentId => {
      const m = dialoguePattern.exec(currentId||'');
      if(!m) return null;
      const curFail = parseInt(m[1],10);
      return `dialogue_${curFail+1}_1`;
    };
    let lineQueue=[];     // 当前阶段行数组
    let lineIndex=0;      // 下一待渲染的行索引
    let stageDoneCallback=null; // 阶段全部行显示完后的回调
    let awaitingLine=false;     // 防止并发推进
    let ended=false;            // 胜利终局后阻断进一步互动

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
        // 行队列完成：保留最后说话人徽标用于提示“是谁的发言导致出现这些选项”
        if(!isTyping && stageDoneCallback) stageDoneCallback();
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

  /**
   * 阶段是否包含终结：有则触发转场到下一场景。
   * end: { next: 'exam' }
   */
  const endStage=stage=>{ if(stage.end){ const nextScene=stage.end.next||'exam'; phaseMsg.textContent='……'; setTimeout(()=>this.ctx.go('transition',{next:nextScene,style:'flash12'}),700); return true; } return false; };

    /**
     * 渲染当前阶段分支按钮；无 choices 时直接返回等待推进或结束。
     */
    // 新三态分支处理：choice.win === true(胜利)/false(失败)/null(普通)
    // 需求变更：不再弹出 overlay，而是：
    //  - win: 隐藏原对话框，直接显示一段胜利文本 + 继续按钮（进入下一场景）
    //  - fail: 不显示弹窗，直接跳转下一失败阶段；若不存在提示缺失
    const handleChoice = (choice)=>{
      if(!choice) return;
      if(choice.win === true){
        if(ended) return; // 避免重复执行
        ended=true;
        const vnWrapper = el.querySelector('.vn-wrapper');
        const vnBox = vnWrapper && vnWrapper.querySelector('.vn-box');
        const localChoices = el.querySelector('.dynamic-choices');
        if(localChoices){
          localChoices.innerHTML='';
          localChoices.style.display='none';
        }
        if(vnBox){
          const winText = (script.meta && script.meta.winText) || '她终于相信了你。\n（这里可以写更走心的过渡文案）';
          const isCompleted = (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('birthday_completed_mark') === 'true');
          const finalBtnHtml = isCompleted ? `<button class='btn-go-final' style='margin-left:.6rem;padding:.65rem 1.2rem;font-size:.95rem;border:none;border-radius:8px;background:#6ab04c;color:#fff;cursor:pointer;'>回到通关页面</button>` : '';
          vnBox.innerHTML=`<div class='win-final' style="animation:fadeIn .35s ease;white-space:pre-line;line-height:1.6;min-height:4.5rem;display:flex;flex-direction:column;justify-content:center;">${winText}</div>
          <div style='text-align:center;margin-top:1rem;'>
            <button class='btn-go-exam' style='padding:.65rem 1.2rem;font-size:.95rem;border:none;border-radius:8px;background:#ff4d84;color:#fff;cursor:pointer;'>进入下一段记忆 →</button>
            ${finalBtnHtml}
          </div>`;
          vnBox.querySelector('.btn-go-exam').addEventListener('click',()=>{
            this.ctx.go('transition',{next:'exam',style:'flash12'});
          });
          const btnFinal = vnBox.querySelector('.btn-go-final');
          if(btnFinal){
            btnFinal.addEventListener('click',()=>{
              try{ this.ctx.go('final'); }catch(e){ console.warn('跳转到 final 失败：', e); }
            });
          }
        }
        return;
      }
      if(choice.win === false){
        const curId = this.currentStage?.id;
        const nextFailId = computeNextFailId(curId);
        if(nextFailId && findStage(nextFailId)){
          goStage(nextFailId);
        } else {
          console.warn('未找到下一失败阶段', nextFailId);
          if(!el.querySelector('.fail-missing-tip')){
            const tip=document.createElement('div');
            tip.className='fail-missing-tip';
            tip.style.cssText='margin-top:.6rem;font-size:.75rem;opacity:.75;';
            tip.textContent='（失败后续阶段未配置，仍停留当前）';
            el.appendChild(tip);
            setTimeout(()=>tip.remove(),4000);
          }
        }
        return;
      }
      // 普通分支：依赖 goto 为阶段 ID
      const target = (choice.goto||'').trim();
      if(!target){
        console.warn('普通分支缺少 goto 阶段 ID', choice);
        return;
      }
      if(!findStage(target)){
        console.warn('阶段不存在：', target);
        if(!el.querySelector('.missing-stage-tip')){
          const tip=document.createElement('div');
          tip.className='missing-stage-tip';
          tip.style.cssText='margin-top:.6rem;font-size:.75rem;opacity:.75;';
          tip.textContent=`（脚本未定义阶段 ${target} ）`;
          el.appendChild(tip);
          setTimeout(()=>tip.remove(),4000);
        }
        return;
      }
      goStage(target);
    };

    const renderChoices=stage=>{
      choicesBox.innerHTML='';
      if(!stage.choices || !stage.choices.length){ return; }
      stage.choices.forEach(choice=>{
        const btn=document.createElement('button');
        btn.type='button';
        btn.textContent=choice.text||'...';
        btn._choiceData=choice; // 保存引用
        choicesBox.appendChild(btn);
      });
      choicesBox.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click', e=>{
          if(btn._handled) return;
          btn._handled=true; setTimeout(()=>btn._handled=false,400);
          handleChoice(btn._choiceData);
        });
      });
      refreshChoiceLockStates();
    };

  // 移动端偶发 click 不触发：增加 pointerup / touchend 兜底（防某些 WebView 丢失 click）
    const choiceTapHandler = (e)=>{
      const btn = e.target.closest('button');
      if(!btn || !choicesBox.contains(btn)) return;
      if(btn._tapHandledAt && performance.now() - btn._tapHandledAt < 250) return; // 节流
      btn._tapHandledAt = performance.now();
      handleChoice(btn._choiceData);
    };
    choicesBox.addEventListener('pointerup', choiceTapHandler, { passive:true });
    // touchend 可能与 pointerup 重复，在现代浏览器 pointer 统一即可；若需兼容旧环境再加。

  /**
   * 跳转阶段：装入 lines → 播放；若阶段含 end 则走转场；否则渲染 choices。
   */
  const goStage=id=>{ const st=findStage(id); if(!st) return; this.currentStage=st; // 清空残留选项防止上一阶段按钮闪留
    const choicesBox=el.querySelector('.dynamic-choices'); if(choicesBox) choicesBox.innerHTML='';
    appendLinesProgressively(st,()=>{ if(endStage(st)) return; renderChoices(st); }); };

    // 推进事件：空格或点击空白区域
  /**
   * 空白推进 / 空格键推进：
   *  - 忽略点击在分支按钮上
   *  - 首次交互预热 WebAudio（typeSfx）
   *  - 打字中：直接补完
   *  - 否则：进入下一行
   */
  const advanceHandler=(e)=>{
      if(ended) return; // 终局后不再允许推进
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

  // 起始阶段选择策略：优先 dialogue_0_1；否则使用脚本第一条；再否则提示无阶段
  // 这样旧脚本/实验脚本可以不用写 fail 体系的 0 号入口也能调试。
  const startId = findStage('dialogue_0_1')? 'dialogue_0_1' : (script.stages[0]?.id || null);
  if(startId) goStage(startId); else {
    vnText.textContent='脚本中未找到任何阶段 (stages[])';
  }
    this.ctx.rootEl.appendChild(el);
  }

  async exit(){ 
    // 退出场景：使用与播放相同的 key '1' 做淡出，避免残留
    audioManager.stopBGM('1',{fadeOut:600}); 
  }
}
