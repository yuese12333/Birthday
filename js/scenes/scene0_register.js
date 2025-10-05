/**
 * 注册 / 纪念日验证场景
 * 目的：增加仪式感，不做真正的用户体系。
 * 规则：
 *  - 用户名任意（可为空）
 *  - 密码必须为 20241007 （在一起的日子）
 *  - 成功后写入 localStorage.hasRegistered = '1' 并跳转 intro 场景
 */
import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';

export class Scene0Register extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-register';
    const has = localStorage.getItem('hasRegistered') === '1';
    el.innerHTML = `
      <h1>进入之前 · 一个小小的仪式</h1>
      <p class='desc'>这是我们专属的纪念入口。随便写一个“用户名”，然后输入那一天的日期当作密码。</p>
      <form class='reg-form'>
        <label>用户名<input name='user' placeholder='请输入用户名' autocomplete='off'/></label>
        <label>密码（纪念日）<input name='pass' type='password' placeholder='请输入密码' autocomplete='off' /></label>
  <div style='display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;'>
    <button type='submit' data-debounce='800'>进入旅程</button>
    <button type='button' class='bgm-btn reg-bgm' title='音乐开关' data-debounce style='background:#ffb3c4;width:46px;height:36px;font-size:.85rem;'>♪</button>
    <button type='button' class='forgot-btn' title='我忘了' data-debounce='600' style='margin-left:auto;'>我忘了</button>
  </div>
        <div class='msg'></div>
      </form>
      <!-- 已按需求移除所有“忘记密码”线索提示。-->

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
          <button type='button' data-jump='resetReg' style='background:#e8a;'>清除注册标记</button>
        </div>
        <p style='margin:.6rem 0 0; line-height:1.4;'>说明：
          1) 按钮直接调用 sceneManager.go；2) 不做状态校验；3) 若需完全移除，删除本 details 块与下方相关监听即可。</p>
      </details>
      <!-- DEBUG PANEL END -->
    `;

    const form = el.querySelector('.reg-form');
    const msg = el.querySelector('.msg');
    const forgotBtn = form.querySelector('.forgot-btn');
    const bgmBtn = form.querySelector('.reg-bgm');
    let bgmKilled = false;
    // 播放注册场景 BGM：尝试立即播放；若被策略阻止则静音播放并等待第一次交互恢复音量
    const bgmAudio = audioManager.playBGM('scene0','./assets/audio/scene_0.mp3',{ loop:true, volume:0.5, fadeIn:700 });
    let awaitingUnlock = false;
    if(bgmAudio){
      // 某些浏览器（移动端）会阻止自动播放，这里检测 play 状态
      if(bgmAudio.paused){
        // 再尝试一次
        bgmAudio.play().catch(()=>{
          // 静音强制播放占位，待手势恢复
          bgmAudio.muted = true;
          awaitingUnlock = true;
          const trySilent = bgmAudio.play();
          if(trySilent){ trySilent.catch(()=>{}); }
          // 首次用户手势（pointerdown）恢复
          const unlock = ()=>{
            if(!awaitingUnlock) return;
            awaitingUnlock = false;
            bgmAudio.muted = false;
            window.removeEventListener('pointerdown', unlock);
          };
            window.addEventListener('pointerdown', unlock, { once:true });
        });
      }
    }
    bgmBtn.addEventListener('click',()=>{
      if(bgmKilled){
        // 不替换现有表情，追加提示（若未追加过）
        if(!msg.querySelector('.no-music-tip')){
          msg.insertAdjacentHTML('beforeend', `<div class='err no-music-tip' style='margin-top:.35rem;animation:pwdShake .5s;'>我生气了，不给你放歌！</div>`);
        } else {
          // 再次点击触发轻微抖动反馈
          const tip = msg.querySelector('.no-music-tip');
          tip.style.animation='none';
          requestAnimationFrame(()=>{ tip.style.animation='pwdShake .5s'; });
        }
        return;
      }
      if(bgmAudio.paused){
        bgmAudio.play().catch(()=>{});
        bgmBtn.classList.remove('muted');
      } else {
        bgmAudio.pause();
        bgmBtn.classList.add('muted');
      }
    });
  // 已去除线索相关节点与逻辑
    let wrongTimes = 0; // 密码错误次数
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const data = new FormData(form);
      const pass = (data.get('pass')||'').trim();
      if(pass === '20241007'){
        localStorage.setItem('hasRegistered','1');
        msg.innerHTML = `<span class='ok'>验证成功！那天开始的一切，都继续写在下面的故事里 ❤</span>`;
        setTimeout(()=> this.ctx.go('intro'), 800);
      } else {
        wrongTimes++;
        if(!bgmKilled){ audioManager.stopBGM('scene0'); bgmKilled=true; bgmBtn.classList.add('muted'); }
        // 生气语句轮播（四条循环）
        const angryLines = [
          '不是你干什么呢？！',
          '好好填！不许乱填！',
          '溜溜！不许这样！',
          '最后警告：再填错我真生气了！'
        ];
        const line = angryLines[(wrongTimes-1) % angryLines.length];
        msg.innerHTML = `<span class='err' style="display:inline-block;animation:pwdShake .5s;">${line}</span>`;
        // 注入一次摇动动画
        if(!document.getElementById('pwd-error-anim')){
          const s = document.createElement('style');
          s.id = 'pwd-error-anim';
          s.textContent = '@keyframes pwdShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(3px);}30%,50%,70%{transform:translateX(-5px);}40%,60%{transform:translateX(5px);} }';
          document.head.appendChild(s);
        }
      }
    });
    // “我忘了”按钮：1~4 次依次累加 angry.png，5 次显示 cry.png 并禁用按钮
    this._forgotClicks = 0;
    forgotBtn.addEventListener('click',()=>{
      if(forgotBtn.disabled) return;
      this._forgotClicks++;
      if(!bgmKilled){ audioManager.stopBGM('scene0'); bgmKilled=true; bgmBtn.classList.add('muted'); }
      if(this._forgotClicks < 5){
        // 生成 N 个 angry 图标
        const count = this._forgotClicks; // 1..4
        let imgs = '';
        for(let i=0;i<count;i++){
          imgs += `<img src='./assets/images/angry.png' alt='angry' style='width:48px;height:48px;margin:2px;animation:pop .4s ease;'>`;
        }
        msg.innerHTML = `<div class='err' style='display:flex;flex-wrap:wrap;align-items:center;'>${imgs}</div>`;
      } else {
  msg.innerHTML = `<div class='err' style="display:flex;justify-content:flex-end;"><img src='./assets/images/cry.png' alt='cry' style='width:70px;height:70px;animation:shakeCry .6s ease;'></div>`;
  forgotBtn.disabled = true;
  forgotBtn.classList.add('disabled');
  forgotBtn.textContent = '不许忘！！！';
        // 添加一次抖动 & 闪烁红边动画类
        forgotBtn.classList.add('shake-once','flash-red');
        setTimeout(()=> forgotBtn.classList.remove('shake-once'), 600);
        // 2 秒后若密码仍为空 -> 修改输入框 placeholder 为 “快输入！”
        const passInput = form.querySelector('input[name="pass"]');
        setTimeout(()=>{
          if(!passInput.value.trim()){
            passInput.placeholder = '快输入！';
          }
        },2000);
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
          if(target === 'resetReg'){
            localStorage.removeItem('hasRegistered');
            msg.innerHTML = `<span class='ok'>已清除标记，可再次体验注册。</span>`;
            return;
          }
          // 跳场景前可选择是否写入注册标记，确保后续流程不被卡住
          if(target !== 'intro' && target !== 'resetReg'){
            localStorage.setItem('hasRegistered','1');
          }
            this.ctx.go(target);
        });
      });
    }
  }
}
