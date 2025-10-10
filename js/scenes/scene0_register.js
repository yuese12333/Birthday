/**
 * 注册 / 纪念日验证场景
 * 目的：增加仪式感，不做真正的用户体系。
 * 规则：
 *  - 用户名任意（可为空）
 *  - 密码必须为 20241007 （在一起的日子）
 */
import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

export class Scene0Register extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-register';
        // 已移除注册印记机制，无需 localStorage 标记
    el.innerHTML = `
      <h1>进入之前 · 一个小小的仪式（开发版本不代表最终品质）</h1>
      <p class='desc'>这是我们专属的纪念入口。随便写一个“用户名”，然后输入那一天的日期当作密码。</p>
      <form class='reg-form'>
        <label>用户名<input name='user' placeholder='请输入用户名' autocomplete='off'/></label>
        <label>密码（纪念日）<input name='pass' type='password' placeholder='请输入密码' autocomplete='off' /></label>
        <div style='display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;'>
          <button type='submit' data-debounce='800'>进入旅程</button>
          <button type='button' class='bgm-btn reg-bgm' title='好听的音乐' data-debounce style='background:#ffb3c4;width:46px;height:36px;font-size:.85rem;'>♪</button>
          <button type='button' class='forgot-btn' title='我忘了' data-debounce='600' style='margin-left:auto;'>我忘了</button>
        </div>
        <div class='msg'></div>
      </form>

      <!-- DEBUG PANEL START (开发期跳场景，成品可整块删除) -->
      <details class='debug-panel' style="margin-top:1rem; font-size:.7rem; opacity:.75;">
        <summary style="cursor:pointer;">⚙ 开发调试：快速跳转场景 (上线前删除)</summary>
        <div style="display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.6rem;">
          <button type='button' data-jump='intro' style='background:#bbb;'>Intro</button>
          <button type='button' data-jump='exam' style='background:#bbb;'>Exam</button>
          <button type='button' data-jump='timeline' style='background:#bbb;'>Timeline</button>
          <button type='button' data-jump='confession' style='background:#bbb;'>Confession</button>
          <button type='button' data-jump='date' style='background:#bbb;'>Date</button>
          <button type='button' data-jump='scarf' style='background:#bbb;'>Scarf</button>
          <button type='button' data-jump='future' style='background:#bbb;'>Future</button>
        </div>
        <p style='margin:.6rem 0 0; line-height:1.4;'>说明：
          1) 按钮直接调用 sceneManager.go；2) 不做状态校验；3) 若需完全移除，删除本 details 块与下方相关监听即可。</p>
      </details>
      <!-- DEBUG PANEL END -->
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    const form = el.querySelector('.reg-form');
    const msg = el.querySelector('.msg');
    const forgotBtn = form.querySelector('.forgot-btn');
    const bgmBtn = form.querySelector('.reg-bgm');

    // ---- BGM 自动播放逻辑 ----
    // 注意：使用 playSceneBGM 传入的是场景 id '0'，其内部以同样的 key '0' 存储。
    // 之前 stopBGM 误用了 'scene0' 作为 key 导致无法真正停止，仅按钮被置灰。
    let bgmKilled = false;
    const bgmAudio = audioManager.playSceneBGM('0',{ loop:true, volume:0.5, fadeIn:700 });
    let awaitingUnlock = false;
    if(bgmAudio && bgmAudio.paused){
      bgmAudio.play().catch(()=>{
        bgmAudio.muted = true; awaitingUnlock = true;
        const silent = bgmAudio.play(); if(silent) silent.catch(()=>{});
        const unlock = ()=>{ if(!awaitingUnlock) return; awaitingUnlock=false; bgmAudio.muted=false; window.removeEventListener('pointerdown', unlock); };
        window.addEventListener('pointerdown', unlock, { once:true });
      });
    }

    // ---- 3 秒自动播放失败检测（仅注册场景启用） ----
    this._audioUnlockBtn = null;
    const scheduleAutoplayCheck = ()=>{
      setTimeout(()=>{
        // 若已经播放（非暂停且有一定进度或 readyState>2）则不提示
        if(!bgmAudio) return;
        const playing = !bgmAudio.paused && bgmAudio.currentTime > 0;
        if(playing) return;
        if(this._audioUnlockBtn) return; // 已存在
        const btn = document.createElement('button');
        btn.className='audio-unlock-tip';
        btn.textContent='怎么没有声音呀？点我播放精心准备的音乐♪';
        btn.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;background:#ff6f90;color:#fff;padding:.55rem 1rem;border:none;border-radius:999px;font-size:.85rem;box-shadow:0 6px 16px -4px rgba(255,80,120,.45);animation:unlockPulse 1.6s ease-in-out infinite;';
        if(!document.getElementById('unlock-audio-keyframes')){
          const k=document.createElement('style');k.id='unlock-audio-keyframes';k.textContent='@keyframes unlockPulse{0%,100%{transform:translate(-50%,0) scale(1);}50%{transform:translate(-50%,0) scale(1.08);} }';document.head.appendChild(k);
        }
        btn.addEventListener('click',()=>{
          bgmAudio.muted=false;
          const p = bgmAudio.play();
          if(p){ p.catch(()=>{}); }
          btn.remove(); this._audioUnlockBtn=null;
        });
        document.body.appendChild(btn);
        this._audioUnlockBtn = btn;
      }, 3000);
    };
    scheduleAutoplayCheck();

    bgmBtn.addEventListener('click',()=>{
      if(bgmKilled){
        if(!msg.querySelector('.no-music-tip')){
          msg.insertAdjacentHTML('beforeend', `<div class='err no-music-tip' style='margin-top:.35rem;animation:pwdShake .5s;'>我生气了，不给你放歌！</div>`);
        } else {
          const tip = msg.querySelector('.no-music-tip');
          tip.style.animation='none'; requestAnimationFrame(()=> tip.style.animation='pwdShake .5s');
        }
        return;
      }
      if(bgmAudio.paused){ bgmAudio.play().catch(()=>{}); bgmBtn.classList.remove('muted'); }
      else { bgmAudio.pause(); bgmBtn.classList.add('muted'); }
    });

    // ---- 错误与提示统一区域结构 ----
    function ensureErrorStructure(){
      let wrap = msg.querySelector('.err-wrap');
      if(!wrap){
        msg.innerHTML='';
        wrap = document.createElement('div');
        wrap.className='err-wrap';
        wrap.style.cssText='display:flex;flex-direction:column;gap:.35rem;';
        msg.appendChild(wrap);
      }
      let imgRow = wrap.querySelector('.err-img-row');
      if(!imgRow){
        imgRow = document.createElement('div');
        imgRow.className='err-img-row';
        imgRow.style.cssText='display:flex;align-items:center;gap:.25rem;';
        wrap.appendChild(imgRow);
      }
      let lines = wrap.querySelector('.err-lines');
      if(!lines){
        lines = document.createElement('div');
        lines.className='err-lines';
        lines.style.cssText='display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;color:#b3002c;';
        wrap.appendChild(lines);
      }
      return { wrap, imgRow, lines };
    }

    if(!document.getElementById('pwd-error-anim')){
      const s=document.createElement('style'); s.id='pwd-error-anim'; s.textContent='@keyframes pwdShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(3px);}30%,50%,70%{transform:translateX(-5px);}40%,60%{transform:translateX(5px);} }'; document.head.appendChild(s);
    }

    let wrongTimes = 0;
    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      const data = new FormData(form);
      const pass = (data.get('pass')||'').trim();
      if(pass === '20241007'){
        msg.innerHTML = `<span class='ok'>验证成功！那天开始的一切，都继续写在下面的故事里 ❤</span>`;
        setTimeout(()=> this.ctx.go('intro'), 800);
      } else {
        wrongTimes++;
  if(!bgmKilled){ audioManager.stopBGM('0'); bgmKilled=true; bgmBtn.classList.add('muted'); }
        const { imgRow, lines } = ensureErrorStructure();
        if(wrongTimes < 5){
          const angryLines = [ 
            '不是你干什么呢？！',
            '好好填！不许乱填！',
            '溜溜！不许这样！',
            '再填错我真生气了！' ];
          // 轮播：每次只显示当前这一条，替换上一条
          lines.innerHTML = '';
          const span=document.createElement('span');
          span.textContent=angryLines[(wrongTimes-1)%angryLines.length];
          span.style.cssText='animation:pwdShake .5s;';
          lines.appendChild(span);
        } else if(wrongTimes === 5){
          if(!imgRow.querySelector('.wrong-cry')){
            const cry=document.createElement('img'); cry.src='./assets/images/cry.png'; cry.alt='cry'; cry.className='wrong-cry'; cry.style.cssText='width:70px;height:70px;animation:shakeCry .6s ease;'; imgRow.appendChild(cry);
          }
        } else if(wrongTimes >= 6){
          const bye=document.createElement('span'); bye.textContent='……我不跟你玩了，退出！'; lines.appendChild(bye); setTimeout(()=>{ try{ window.close(); }catch(e){} location.href='about:blank'; }, 800);
        }
      }
    });
    // “我忘了”按钮：1~4 次依次累加 angry.png，5 次显示 cry.png 并禁用按钮
    this._forgotClicks = 0;
    forgotBtn.addEventListener('click',()=>{
      if(forgotBtn.disabled) return;
      this._forgotClicks++;
  if(!bgmKilled){ audioManager.stopBGM('0'); bgmKilled=true; bgmBtn.classList.add('muted'); }
      // 使用统一结构，避免后续密码错误覆盖表情
      const { imgRow } = ensureErrorStructure();
      // 查找或创建忘记表情容器
      let faceGroup = imgRow.querySelector('.forgot-faces');
      if(!faceGroup){
        faceGroup = document.createElement('div');
        faceGroup.className = 'forgot-faces';
        faceGroup.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
        imgRow.appendChild(faceGroup);
      }
      if(this._forgotClicks < 5){
        // 1~4 次：用 N 个 angry 图，先清空再生成，保持数量与点击次数一致
        faceGroup.innerHTML = '';
        for(let i=0;i<this._forgotClicks;i++){
          const im = document.createElement('img');
          im.src = './assets/images/angry.png';
          im.alt = 'angry';
          im.style.cssText = 'width:48px;height:48px;margin:2px;animation:pop .4s ease;';
          faceGroup.appendChild(im);
        }
      } else {
        // 第5次：移除 angry 组，添加哭脸（靠右不会影响密码错误时的行）
        faceGroup.remove();
        if(!imgRow.querySelector('.forgot-cry')){
          const cry = document.createElement('img');
          cry.src='./assets/images/cry.png';
          cry.alt='cry';
          cry.className='forgot-cry';
          cry.style.cssText='width:70px;height:70px;animation:shakeCry .6s ease;margin-left:auto;';
          imgRow.appendChild(cry);
        }
        forgotBtn.disabled = true;
        forgotBtn.classList.add('disabled');
        forgotBtn.textContent = '不许忘！！！';
        forgotBtn.classList.add('shake-once','flash-red');
        setTimeout(()=> forgotBtn.classList.remove('shake-once'), 600);
        const passInput = form.querySelector('input[name="pass"]');
        setTimeout(()=>{ if(!passInput.value.trim()) passInput.placeholder='快输入！'; },2000);
      }
    });
    // 简单弹出/哭泣动画（内联追加一次）
    if(!document.getElementById('register-emoji-anim')){
      const style = document.createElement('style');
      style.id = 'register-emoji-anim';
  style.textContent = `@keyframes pop{0%{transform:scale(.3);opacity:0;}60%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);} }@keyframes shakeCry{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px);}50%{transform:translateX(4px);}75%{transform:translateX(-3px);} }@keyframes btnShake{0%,100%{transform:translateX(0);}20%,60%{transform:translateX(-5px);}40%,80%{transform:translateX(5px);} }@keyframes flashRed{0%,100%{box-shadow:0 0 0 0 rgba(255,0,60,.0);}50%{box-shadow:0 0 0 4px rgba(255,0,60,.55);} }@keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} } .shake-once{animation:btnShake .6s ease;} .flash-red{animation:flashRed 1.3s ease-in-out infinite alternate; background:#ff5f7f !important; color:#fff !important;}`;
      document.head.appendChild(style);
    }
    this.ctx.rootEl.appendChild(el);

    // DEBUG: 场景跳转按钮绑定（开发期使用）
    const debugPanel = el.querySelector('.debug-panel');
    if(debugPanel){
      debugPanel.querySelectorAll('button[data-jump]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const target = btn.getAttribute('data-jump');
          // 跳场景前可选择是否写入注册标记，确保后续流程不被卡住
          if(target !== 'intro' && target !== 'resetReg'){
          }
            this.ctx.go(target);
        });
      });
    }
  }

  async exit(){
    // 离开注册场景时确保背景音乐淡出停止，防止串场
  // 退出时同样使用正确的 key '0'
  audioManager.stopBGM('0',{ fadeOut:600 });
    if(this._audioUnlockBtn){ try{ this._audioUnlockBtn.remove(); }catch(e){} this._audioUnlockBtn=null; }
  }
}
