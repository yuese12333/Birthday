import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { typeSfx } from '../core/typeSfx.js';

// 场景1：纯分支视觉小说（已移除信任/安抚数值系统）
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
    const vnBox=el.querySelector('.vn-box');
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

    const refreshChoiceLockStates=()=>{}; // 不再有锁定需求

    // 加载脚本
    let script=null; try{ const resp=await fetch('./data/scene1_script.json?_='+Date.now()); if(resp.ok) script=await resp.json(); }catch(e){}
    if(!script || !Array.isArray(script.stages)) script={stages:[{id:'intro',lines:[{speaker:'system',text:'脚本加载失败，使用兜底。'}]}]};

    const findStage=id=>script.stages.find(s=>s.id===id);
    let lineQueue=[]; let lineIndex=0; let stageDoneCallback=null; let awaitingLine=false;
    // 打字机状态
  let isTyping=false; let typingTimer=null; let currentFullText=''; let typingIndex=0; const typingSpeed=34; // ms/char 可调
  let sfxCharCounter=0; // 控制每隔若干有效字符触发一次声音
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
  const appendLinesProgressively=(stage,done)=>{ lineQueue=(stage&&stage.lines)?[...stage.lines]:[]; lineIndex=0; stageDoneCallback=done; awaitingLine=false; vnText.textContent=''; renderNextLine(); };

  // 自动跳转逻辑（基于数值）已移除。

    const endStage=stage=>{ if(stage.end){ const nextScene=stage.end.next||'exam'; phaseMsg.textContent='……'; setTimeout(()=>this.ctx.go('transition',{next:nextScene,style:'flash12'}),700); return true; } return false; };

    const renderChoices=stage=>{
      choicesBox.innerHTML='';
      if(!stage.choices || !stage.choices.length){ refreshChoiceLockStates(); return; }
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

    // 移动端偶发 click 不触发，增加 pointerup / touchend 委托作为兜底
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

    const goStage=id=>{ const st=findStage(id); if(!st) return; this.currentStage=st; appendLinesProgressively(st,()=>{ if(endStage(st)) return; renderChoices(st); }); };

    // 推进事件：空格或点击空白区域
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

    // 标题彩蛋
  title.addEventListener('click',()=>{ this.titleClicks++; if(this.titleClicks===6){ titleEgg.textContent='（再点几下也许会有点什么~）'; titleEgg.classList.remove('hidden'); } if(this.titleClicks===10 && !this._titleBonusGiven){ this._titleBonusGiven=true; titleEgg.textContent='（给你一个看不见的勇气 buff！）'; }});

    goStage('intro');
    this.ctx.rootEl.appendChild(el);
  }

  async exit(){ 
    audioManager.stopBGM('scene1',{fadeOut:600}); 
  }
}
