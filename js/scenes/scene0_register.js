/**
 * 注册 / 纪念日验证场景
 * 目的：增加仪式感，不做真正的用户体系。
 * 规则：
 *  - 用户名任意（可为空）
 *  - 密码必须为 20241007 （在一起的日子）
 *  - 成功后写入 localStorage.hasRegistered = '1' 并跳转 intro 场景
 *  - 若已经注册过直接提示并允许进入
 */
import { BaseScene } from '../core/baseScene.js';

export class Scene0Register extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className = 'scene scene-register';
    const has = localStorage.getItem('hasRegistered') === '1';
    el.innerHTML = `
      <h1>进入之前 · 一个小小的仪式</h1>
      <p class='desc'>这是我们专属的纪念入口。随便写一个“用户名”，然后输入那一天的日期当作密码。</p>
      <form class='reg-form'>
        <label>用户名（随意）<input name='user' placeholder='比如：小笨蛋' autocomplete='off'/></label>
        <label>密码（纪念日）<input name='pass' type='password' placeholder='8位数字' autocomplete='off' /></label>
  <button type='submit' data-debounce='800'>进入旅程</button>
  <button type='button' class='forgot-btn' title='我忘了' data-debounce='600'>我忘了</button>
        <div class='msg'></div>
      </form>
      <div class='tips'>
        <p>提示：密码是我们在一起的日子，格式：YYYYMMDD。</p>
        ${has ? `<p class='already'>检测到你已验证过，可直接再次进入 ❤</p>`:''}
        <div class='clues hidden'>
          <p class='clue-line base'>线索一：年份是在 <strong>2024</strong> 年。</p>
          <p class='clue-line mid hidden'>线索二：月份是我们一起吃好吃的纪念那月（10月）。</p>
          <p class='clue-line full hidden'>线索三：那天日期是 07（日）。合起来就是：<em>YYYYMMDD</em> → 20241007 ❤</p>
        </div>
      </div>

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
    const cluesBox = el.querySelector('.clues');
  const baseLine = () => cluesBox.querySelector('.base');
  const midLine = () => cluesBox.querySelector('.mid');
  const fullLine = () => cluesBox.querySelector('.full');
  const reveal = (node)=>{ if(node && node.classList.contains('hidden')){ node.classList.remove('hidden'); node.classList.add('revealed'); } };
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
        let extra = '';
        if(wrongTimes === 3){
          extra = '（解锁线索一：查看下方线索区域）';
          cluesBox.classList.remove('hidden');
        } else if(wrongTimes === 5){
          extra = '（线索二出现了！）';
          cluesBox.querySelector('.mid').classList.remove('hidden');
        } else if(wrongTimes >= 7){
          extra = '（终极线索已全部显示 ❤）';
          cluesBox.querySelector('.full').classList.remove('hidden');
        }
        msg.innerHTML = `<span class='err'>密码不对哦。再想想：我们确立关系的那天，一共 8 个数字~ ${extra}</span>`;
      }
    });
    forgotBtn.addEventListener('click',()=>{
      cluesBox.classList.remove('hidden');
      // 单步解锁：优先 base -> mid -> full
      if(baseLine().classList.contains('hidden')){
        reveal(baseLine());
        msg.innerHTML = `<span class='ok'>先想起年份 ~</span>`;
      } else if(midLine().classList.contains('hidden')){
        reveal(midLine());
        msg.innerHTML = `<span class='ok'>再想想我们一起的那个月份 ~</span>`;
      } else if(fullLine().classList.contains('hidden')){
        reveal(fullLine());
        msg.innerHTML = `<span class='ok'>全部线索已献上，去输入吧！</span>`;
        forgotBtn.disabled = true;
        forgotBtn.classList.add('disabled');
      }
    });
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
