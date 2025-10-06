import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { typeSfx } from '../core/typeSfx.js';

// 场景1：脚本驱动分支叙事（信任值 + 安抚值）
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
      <div class='bars hidden'>
        <div class='bar-block trust-block'>
          <div class='label'>信任值 <span class='trust-val'>0</span>/<span class='trust-tar'>60</span></div>
          <div class='trust-bar'><span class='trust-fill'></span></div>
        </div>
        <div class='bar-block mood-block'>
          <div class='progress-line'>安抚值 <span class='val'>0</span> / <span class='tar'>100</span> <span class='combo-badge hidden'></span></div>
          <div class='mood-bar'><span class='fill'></span></div>
        </div>
      </div>
      <div style="display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; margin-top:.5rem;">
        <div class='phase-msg' data-phase='start'>回忆缓冲中...</div>
        <button class='bgm-btn intro-bgm' title='好听的音乐' style='margin-left:auto;'>♪</button>
      </div>
      <div class='title-egg hidden'></div>
    `;

    // 状态变量
    this.trust=0; this.trustTarget=60;
    this.mood=0; this.moodTarget=100;
    this.tags=new Set();
    this.titleClicks=0; this._titleBonusGiven=false;

    // 引用
  const vnBox=el.querySelector('.vn-box');
  const vnText=el.querySelector('.vn-text');
  const speakerLeft=el.querySelector('.vn-speaker.left');
  const speakerRight=el.querySelector('.vn-speaker.right');
  const choicesBox=el.querySelector('.dynamic-choices');
    const trustFill=el.querySelector('.trust-fill');
    const trustValEl=el.querySelector('.trust-val');
    const moodFill=el.querySelector('.mood-bar .fill');
    const moodValEl=el.querySelector('.val');
    const comboBadge=el.querySelector('.combo-badge');
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

    const phaseTexts=[
      {max:0.3,text:'她还很紧张，耐心陪着她。'},
      {max:0.6,text:'她呼吸慢慢放缓，继续。'},
      {max:1.0,text:'快完全平静了，再来一点点。'}
    ];
    const updatePhase=()=>{ const r=this.mood/this.moodTarget; const f=phaseTexts.find(p=>r<=p.max); if(f) phaseMsg.textContent=f.text; };

    const spawnBubble=(btn,text,cls='')=>{ if(!btn) return; const rect=btn.getBoundingClientRect(); const b=document.createElement('div'); b.className='mood-bubble '+cls; b.textContent=text; b.style.left=(rect.left+rect.width/2+window.scrollX)+'px'; b.style.top=(rect.top+window.scrollY-10)+'px'; document.body.appendChild(b); requestAnimationFrame(()=>b.classList.add('rise')); setTimeout(()=>b.remove(),1200); };

    const updateTrust=()=>{ const ratio=Math.min(1,this.trust/this.trustTarget); trustFill.style.width=(ratio*100)+'%'; trustValEl.textContent=this.trust; evaluateAuto(); };
    const updateMood=()=>{ const ratio=Math.min(1,this.mood/this.moodTarget); moodFill.style.width=(ratio*100)+'%'; moodValEl.textContent=this.mood; updatePhase(); evaluateAuto(); refreshChoiceLockStates(); };

    const refreshChoiceLockStates=()=>{
      choicesBox.querySelectorAll('button[data-require-mood],button[data-require-trust]').forEach(btn=>{
        const needMood=parseInt(btn.dataset.requireMood||'0',10); const needTrust=parseInt(btn.dataset.requireTrust||'0',10);
        const okMood=this.mood>=needMood; const okTrust=this.trust>=needTrust;
        btn.disabled=!(okMood && okTrust);
        btn.classList.toggle('locked',btn.disabled);
      });
    };

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

    const evaluateAuto=()=>{ if(!this.currentStage) return; const auto=this.currentStage.auto; if(!auto) return; const needT=auto.requireTrust; const needM=auto.requireMood; if((needT==null||this.trust>=needT)&&(needM==null||this.mood>=needM)){ const gotoId=auto.goto; if(gotoId && !this._pendingAuto){ this._pendingAuto=true; setTimeout(()=>{ this._pendingAuto=false; goStage(gotoId); },400); } } };

  const endStage=stage=>{ if(stage.end){ const nextScene=stage.end.next||'exam'; phaseMsg.textContent='……'; setTimeout(()=>this.ctx.go('transition',{next:nextScene,style:'flash12'}),700); return true; } return false; };

  const renderChoices=stage=>{ choicesBox.innerHTML=''; if(!stage.choices||!stage.choices.length){ refreshChoiceLockStates(); return; } stage.choices.forEach(choice=>{ const btn=document.createElement('button'); btn.textContent=choice.text||'...'; if(choice.requireMood!=null) btn.dataset.requireMood=choice.requireMood; if(choice.requireTrust!=null) btn.dataset.requireTrust=choice.requireTrust; btn.addEventListener('click',()=>{ if(btn.disabled) return; if(typeof choice.trustDelta==='number'){ const before=this.trust; this.trust+=choice.trustDelta; if(this.trust<0) this.trust=0; if(this.trust>this.trustTarget) this.trust=this.trustTarget; const diff=this.trust-before; if(diff!==0) spawnBubble(btn,(diff>0?'+':'')+diff,'trust'); updateTrust(); } if(typeof choice.moodDelta==='number'){ const beforeM=this.mood; this.mood+=choice.moodDelta; if(this.mood<0) this.mood=0; if(this.mood>this.moodTarget) this.mood=this.moodTarget; const diffM=this.mood-beforeM; if(diffM!==0) spawnBubble(btn,(diffM>0?'+':'')+diffM,(diffM>=0?'pos':'neg')); updateMood(); } if(Array.isArray(choice.tagsAdd)){ const prev=this.tags.size; choice.tagsAdd.forEach(t=>this.tags.add(t)); if(this.tags.size>prev){ const level=this.tags.size; comboBadge.textContent='多样陪伴 x'+level; comboBadge.classList.remove('hidden'); comboBadge.classList.add('flash'); setTimeout(()=>comboBadge.classList.remove('flash'),500); } } if(choice.goto){ goStage(choice.goto); return; } }); choicesBox.appendChild(btn); }); refreshChoiceLockStates(); };

  const goStage=id=>{ const st=findStage(id); if(!st) return; this.currentStage=st; appendLinesProgressively(st,()=>{ if(endStage(st)) return; renderChoices(st); evaluateAuto(); }); };

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
    title.addEventListener('click',()=>{ this.titleClicks++; if(this.titleClicks===6){ titleEgg.textContent='（再点几下也许会有点什么~）'; titleEgg.classList.remove('hidden'); } if(this.titleClicks===10 && !this._titleBonusGiven){ this._titleBonusGiven=true; this.mood=Math.min(this.moodTarget,this.mood+5); spawnBubble(title,'+5','egg'); updateMood(); }});

    goStage('intro');
    updateTrust(); updateMood();
    this.ctx.rootEl.appendChild(el);
  }

  async exit(){ 
    audioManager.stopBGM('scene1',{fadeOut:600}); 
  }
}
