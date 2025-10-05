import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

// 场景1：脚本驱动分支叙事（信任值 + 安抚值）
export class Scene1Intro extends BaseScene {
  async enter(){
    const el=document.createElement('div');
    el.className='scene scene-intro';
    el.innerHTML=`
      <h1 class='intro-title'>穿越回高中</h1>
      <div class='dialogue-box'></div>
      <div class='bars'>
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
        <button class='bgm-btn intro-bgm' title='音乐开关' style='margin-left:auto;'>♪</button>
      </div>
      <div class='choices dynamic-choices'></div>
      <div class='title-egg hidden'></div>
    `;

    // 状态变量
    this.trust=0; this.trustTarget=60;
    this.mood=0; this.moodTarget=100;
    this.tags=new Set();
    this.titleClicks=0; this._titleBonusGiven=false;

    // 引用
    const dialogueBox=el.querySelector('.dialogue-box');
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
    const bgmAudio=audioManager.playBGM('scene1','./assets/audio/scene_1.mp3',{loop:true,volume:0.55,fadeIn:900});
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
    const appendLines=stage=>{ if(!stage||!stage.lines) return; stage.lines.forEach(l=>{ const div=document.createElement('div'); div.className='line '+(l.speaker==='me'?'mine':l.speaker==='her'?'her':'system'); if(l.speaker==='system'||l.speaker==='narration') div.classList.add('hint'); div.textContent=(l.speaker==='me'?'我：':l.speaker==='her'?'她：':'')+l.text; dialogueBox.appendChild(div); }); dialogueBox.scrollTop=dialogueBox.scrollHeight; };

    const evaluateAuto=()=>{ if(!this.currentStage) return; const auto=this.currentStage.auto; if(!auto) return; const needT=auto.requireTrust; const needM=auto.requireMood; if((needT==null||this.trust>=needT)&&(needM==null||this.mood>=needM)){ const gotoId=auto.goto; if(gotoId && !this._pendingAuto){ this._pendingAuto=true; setTimeout(()=>{ this._pendingAuto=false; goStage(gotoId); },400); } } };

    const endStage=stage=>{ if(stage.end){ const nextScene=stage.end.next||'exam'; phaseMsg.textContent='……'; setTimeout(()=>this.ctx.go('transition',{next:nextScene,style:'heart'}),700); return true; } return false; };

    const renderChoices=stage=>{ choicesBox.innerHTML=''; if(!stage.choices||!stage.choices.length){ refreshChoiceLockStates(); return; } stage.choices.forEach(choice=>{ const btn=document.createElement('button'); btn.textContent=choice.text||'...'; if(choice.requireMood!=null) btn.dataset.requireMood=choice.requireMood; if(choice.requireTrust!=null) btn.dataset.requireTrust=choice.requireTrust; btn.addEventListener('click',()=>{ if(btn.disabled) return; if(typeof choice.trustDelta==='number'){ const before=this.trust; this.trust+=choice.trustDelta; if(this.trust<0) this.trust=0; if(this.trust>this.trustTarget) this.trust=this.trustTarget; const diff=this.trust-before; if(diff!==0) spawnBubble(btn,(diff>0?'+':'')+diff,'trust'); updateTrust(); } if(typeof choice.moodDelta==='number'){ const beforeM=this.mood; this.mood+=choice.moodDelta; if(this.mood<0) this.mood=0; if(this.mood>this.moodTarget) this.mood=this.moodTarget; const diffM=this.mood-beforeM; if(diffM!==0) spawnBubble(btn,(diffM>0?'+':'')+diffM,(diffM>=0?'pos':'neg')); updateMood(); } if(Array.isArray(choice.tagsAdd)){ const prev=this.tags.size; choice.tagsAdd.forEach(t=>this.tags.add(t)); if(this.tags.size>prev){ const level=this.tags.size; comboBadge.textContent='多样陪伴 x'+level; comboBadge.classList.remove('hidden'); comboBadge.classList.add('flash'); setTimeout(()=>comboBadge.classList.remove('flash'),500); } } if(choice.goto){ goStage(choice.goto); return; } }); choicesBox.appendChild(btn); }); refreshChoiceLockStates(); };

    const goStage=id=>{ const st=findStage(id); if(!st) return; this.currentStage=st; appendLines(st); if(endStage(st)) return; renderChoices(st); evaluateAuto(); };

    // 标题彩蛋
    title.addEventListener('click',()=>{ this.titleClicks++; if(this.titleClicks===6){ titleEgg.textContent='（再点几下也许会有点什么~）'; titleEgg.classList.remove('hidden'); } if(this.titleClicks===10 && !this._titleBonusGiven){ this._titleBonusGiven=true; this.mood=Math.min(this.moodTarget,this.mood+5); spawnBubble(title,'+5','egg'); updateMood(); }});

    goStage('intro');
    updateTrust(); updateMood();
    this.ctx.rootEl.appendChild(el);
  }

  async exit(){ audioManager.stopBGM('scene1',{fadeOut:600}); }
}
