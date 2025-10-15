/*
<div class="checkbox-wrapper">
  <input checked="" type="checkbox" class="check" id="check1-61">
  <label for="check1-61" class="label">
    <svg width="45" height="45" viewBox="0 0 95 95">
      <rect x="30" y="20" width="50" height="50" stroke="black" fill="none"></rect>
      <g transform="translate(0,-952.36222)">
        <path d="m 56,963 c -102,122 6,9 7,9 17,-5 -66,69 -38,52 122,-77 -7,14 18,4 29,-11 45,-43 23,-4" stroke="black" stroke-width="3" fill="none" class="path1"></path>
      </g>
    </svg>
    <span>Checkbox</span>
  </label>
</div>

.checkbox-wrapper input[type="checkbox"] {
  visibility: hidden;
  display: none;
}

.checkbox-wrapper *,
  .checkbox-wrapper ::after,
  .checkbox-wrapper ::before {
  box-sizing: border-box;
  user-select: none;
}

.checkbox-wrapper {
  position: relative;
  display: block;
  overflow: hidden;
}

.checkbox-wrapper .label {
  cursor: pointer;
}

.checkbox-wrapper .check {
  width: 50px;
  height: 50px;
  position: absolute;
  opacity: 0;
}

.checkbox-wrapper .label svg {
  vertical-align: middle;
}

.checkbox-wrapper .path1 {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  transition: .5s stroke-dashoffset;
  opacity: 0;
}

.checkbox-wrapper .check:checked + label svg g path {
  stroke-dashoffset: 0;
  opacity: 1;
}
*/

/**
 * 注册 / 纪念日验证场景
 * 目的：增加仪式感，不做真正的用户体系。
 * 规则：
 *  - 用户名任意（可为空）
 *  - 密码必须为 20241007 （在一起的日子）
 */
import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { achievements } from '../core/achievements.js';

export class Scene0Register extends BaseScene {
  async enter() {
    const el = document.createElement('div');
    el.className = 'scene scene-register';
    // 注册场景（本地纪念式验证，不建立真实账号体系）
    el.innerHTML = `
      <h1>进入之前 · 一个小小的仪式（开发版本不代表最终品质）</h1>
      <p class='desc'>这是我们专属的纪念入口。随便写一个“用户名”，然后输入那一天的日期当作密码。</p>
      <form class='reg-form'>
        <div class='form-control'>
          <input name='user' type='text' required placeholder=' ' autocomplete='off' title='请输入用户名' />
          <label><span style='transition-delay:0ms'>用</span><span style='transition-delay:80ms'>户</span><span style='transition-delay:160ms'>名</span></label>
        </div>
        <div class='form-control'>
          <input name='pass' type='password' required placeholder=' ' autocomplete='off' title='请输入密码' />
          <label><span style='transition-delay:0ms'>密</span><span style='transition-delay:80ms'>码</span><span style='transition-delay:160ms'>（</span><span style='transition-delay:240ms'>纪</span><span style='transition-delay:320ms'>念</span><span style='transition-delay:400ms'>日</span><span style='transition-delay:480ms'>）</span></label>
        </div>
        <div style='display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;'>
          <button type='submit' data-debounce='800'>进入旅程</button>
          <button type='button' class='bgm-btn reg-bgm' title='好听的音乐' data-debounce style='background:#ffb3c4;width:46px;height:36px;font-size:.85rem;'>♪</button>
          <button type='button' class='forgot-btn' title='我忘了' data-debounce='600' style='margin-left:auto;'>我忘了</button>
        </div>
        <div class='agreement-row'>
          <label class='agreement-check-wrapper'>
            <input type='checkbox' class='agreement-check' />
            <span class='box' aria-hidden='true'>
              <svg viewBox='0 0 95 95' class='tick-svg'>
                <rect x='30' y='20' width='50' height='50' class='outline'/>
                <g transform='translate(0,-952.36222)'>
                  <path d='m 56,963 c -102,122 6,9 7,9 17,-5 -66,69 -38,52 122,-77 -7,14 18,4 29,-11 45,-43 23,-4' class='tick-path'></path>
                </g>
              </svg>
            </span>
            <span class='agreement-text'>我已阅读并同意 <button type='button' class='link-service-agreement'>服务协议</button></span>
          </label>
        </div>
        <div class='msg'></div>
      </form>

  <!-- DEV: 场景跳转调试面板（发布可整体删除 details.debug-panel） -->
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
          <button type='button' data-jump='final' style='background:#bbb;'>Final</button>
          <!-- DEV: 清空本地成就按钮（发布删除） -->
          <button type='button' data-clear-achievements style='background:#faa;color:#700;border:1px dashed #f55;padding:.35rem .6rem;border-radius:6px;'>清空成就</button>
        </div>
        <p style='margin:.6rem 0 0; line-height:1.4;'>说明：按钮直接调用 sceneManager.go，不做状态校验；上线前删除本面板。</p>
      </details>
      <!-- /DEV PANEL -->
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    const form = el.querySelector('.reg-form');
    const msg = el.querySelector('.msg');
    const forgotBtn = form.querySelector('.forgot-btn');
    const bgmBtn = form.querySelector('.reg-bgm');
    const agreementWrapper = el.querySelector('.agreement-check-wrapper');
    const agreementInput = el.querySelector('.agreement-check');
    const agreementLinkBtn = el.querySelector('.link-service-agreement');

    // 注入协议复选框样式（防重复）
    if (!document.getElementById('agreement-style')) {
      const st = document.createElement('style');
      st.id = 'agreement-style';
      st.textContent = `
      .agreement-row { margin:.85rem 0 .2rem; font-size:.75rem; line-height:1.3; color:#444; }
      .agreement-check-wrapper { position:relative; display:inline-flex; align-items:center; gap:.55rem; cursor:pointer; user-select:none; }
      .agreement-check-wrapper input { position:absolute; opacity:0; pointer-events:none; }
      .agreement-check-wrapper .box { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; }
      .agreement-check-wrapper .tick-svg { width:32px; height:32px; }
      .agreement-check-wrapper .outline { stroke:#ff6f90; fill:none; stroke-width:3; rx:6; }
      .agreement-check-wrapper .tick-path { stroke:#ff6f90; stroke-width:3; fill:none; stroke-dasharray:400; stroke-dashoffset:400; opacity:0; transition:.5s stroke-dashoffset, .3s opacity; }
      .agreement-check-wrapper input:checked + span .tick-path { stroke-dashoffset:0; opacity:1; }
      .agreement-text { display:inline; }
      .agreement-text .link-service-agreement { background:none; border:none; color:#ff4f7c; cursor:pointer; padding:0 2px; font-size:.75rem; text-decoration:underline; }
      .agreement-text .link-service-agreement:hover { color:#ff2f66; }
      .agreement-check-wrapper.agreement-error-shake { animation:pwdShake .5s; }
      .agreement-check-wrapper.agreement-glow { box-shadow:0 0 0 3px rgba(255,111,144,.45); border-radius:8px; transition:.5s box-shadow; }
      .agreement-check-wrapper.agreement-glow.fade { box-shadow:0 0 0 0 rgba(255,111,144,0); }
      .agreement-overlay { position:fixed; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,.5); z-index:100000; display:flex; align-items:center; justify-content:center; animation:fadeIn .25s ease; }
      .agreement-dialog { background:rgba(255,255,255,.98); width:min(620px,92vw); max-height:82vh; overflow:auto; border-radius:14px; padding:1.1rem 1.2rem 1.3rem; box-shadow:0 18px 50px -8px rgba(0,0,0,.35); position:relative; font-size:.78rem; line-height:1.55; color:#333; }
      .agreement-dialog h2 { margin:0 0 .6rem; font-size:1.05rem; font-weight:600; color:#ff4f7c; }
      .agreement-dialog .close-btn { position:absolute; right:10px; top:8px; background:#ff6f90; color:#fff; border:none; border-radius:6px; padding:.35rem .6rem; cursor:pointer; font-size:.7rem; }
      .agreement-dialog .close-btn:hover { background:#ff537f; }
      .agreement-dialog::-webkit-scrollbar { width:8px; }
      .agreement-dialog::-webkit-scrollbar-thumb { background:#ff9fb4; border-radius:6px; }
      .agreement-dialog section { margin-bottom:.85rem; }
      .agreement-dialog section:last-child { margin-bottom:0; }
      /* 避免被 .scene-register label {flex-direction:column} 影响：仅协议区域内 label 还原为行 */
      .agreement-row > .agreement-check-wrapper { display:inline-flex; flex-direction:row !important; align-items:center; }
      .agreement-row > .agreement-check-wrapper span.box { margin:0; }
      .agreement-row .agreement-text { white-space:nowrap; }
      `;
      document.head.appendChild(st);
    }

    // 协议弹窗逻辑（动态加载 JSON + 缓存）
    let _protocolCache = null; // {title,updatedAt,intro,sections[],ending}
    async function fetchProtocol() {
      if (_protocolCache) return _protocolCache;
      try {
        const res = await fetch('./data/scene0_protocol.json?_=' + Date.now());
        if (!res.ok) throw new Error('status ' + res.status);
        const json = await res.json();
        _protocolCache = json;
        return json;
      } catch (e) {
        throw e;
      }
    }
    function buildProtocolHTML(data) {
      try {
        const parts = [];
        parts.push(`<h2>${data.title || '服务协议'}</h2>`);
        if (data.intro) parts.push(`<section><p>${escapeHTML(data.intro)}</p></section>`);
        (data.sections || []).forEach((sec, idx) => {
          const heading = escapeHTML(sec.heading || '节 ' + (idx + 1));
          parts.push(
            `<section><h3 style='margin:.5rem 0 .35rem;font-size:.85rem;color:#ff4f7c;'>${heading}</h3>`
          );
          (sec.paragraphs || []).forEach((p) => {
            parts.push(`<p>${escapeHTML(p)}</p>`);
          });
          parts.push('</section>');
        });
        if (data.ending) parts.push(`<section><p>${escapeHTML(data.ending)}</p></section>`);
        parts.push(
          `<section><p style='margin-top:.8rem;color:#666;font-size:.7rem;'>最后更新：<span>${escapeHTML(
            data.updatedAt || ''
          )}</span></p></section>`
        );
        return parts.join('');
      } catch (e) {
        return `<p style='color:#b3002c;'>解析协议内容失败，请稍后再试。</p>`;
      }
    }
    function escapeHTML(str) {
      return String(str).replace(
        /[&<>"]+/g,
        (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s] || s)
      );
    }
    function openAgreementModal() {
      if (document.querySelector('.agreement-overlay')) return; // 防重复
      const overlay = document.createElement('div');
      overlay.className = 'agreement-overlay';
      const dialog = document.createElement('div');
      dialog.className = 'agreement-dialog';
      dialog.innerHTML = `
        <button type='button' class='close-btn'>关闭</button>
        <h2>加载中…</h2>
        <section><p style='opacity:.7;'>正在获取协议内容，请稍候。</p></section>
      `;
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const close = () => {
        try {
          overlay.remove();
        } catch (e) {}
      };
      dialog.querySelector('.close-btn').addEventListener('click', close);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) close();
      });
      const esc = (ev) => {
        if (ev.key === 'Escape') {
          close();
          window.removeEventListener('keydown', esc);
        }
      };
      window.addEventListener('keydown', esc);

      // 动态加载
      fetchProtocol()
        .then((data) => {
          dialog.innerHTML =
            `<button type='button' class='close-btn'>关闭</button>` + buildProtocolHTML(data);
          dialog.querySelector('.close-btn').addEventListener('click', close);
        })
        .catch((err) => {
          dialog.innerHTML = `<button type='button' class='close-btn'>关闭</button><h2>服务协议（占位）</h2><section><p style='color:#b3002c;'>加载失败：${escapeHTML(
            err.message || '未知错误'
          )}。使用临时占位内容。</p></section><section><p>本协议为占位文本，网络异常或路径错误导致正式内容未能载入。</p></section>`;
          dialog.querySelector('.close-btn').addEventListener('click', close);
        });
    }
    if (agreementLinkBtn) {
      agreementLinkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAgreementModal();
      });
    }

    // ---- BGM 自动播放逻辑 ----
    // 注意：使用 playSceneBGM 传入的是场景 id '0'，其内部以同样的 key '0' 存储。
    // 之前 stopBGM 误用了 'scene0' 作为 key 导致无法真正停止，仅按钮被置灰。
    let bgmKilled = false;
    const bgmAudio = audioManager.playSceneBGM('0', { loop: true, volume: 0.5, fadeIn: 700 });
    let awaitingUnlock = false;
    if (bgmAudio && bgmAudio.paused) {
      bgmAudio.play().catch(() => {
        bgmAudio.muted = true;
        awaitingUnlock = true;
        const silent = bgmAudio.play();
        if (silent) silent.catch(() => {});
        const unlock = () => {
          if (!awaitingUnlock) return;
          awaitingUnlock = false;
          bgmAudio.muted = false;
          window.removeEventListener('pointerdown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true });
      });
    }

    // ---- 3 秒自动播放失败检测（仅注册场景启用） ----
    this._audioUnlockBtn = null;
    const scheduleAutoplayCheck = () => {
      setTimeout(() => {
        // 若已经播放（非暂停且有一定进度或 readyState>2）则不提示
        if (!bgmAudio) return;
        const playing = !bgmAudio.paused && bgmAudio.currentTime > 0;
        if (playing) return;
        if (this._audioUnlockBtn) return; // 已存在
        const btn = document.createElement('button');
        btn.className = 'audio-unlock-tip';
        btn.textContent = '怎么没有声音呀？点我播放精心准备的音乐♪';
        btn.style.cssText =
          'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;background:#ff6f90;color:#fff;padding:.55rem 1rem;border:none;border-radius:999px;font-size:.85rem;box-shadow:0 6px 16px -4px rgba(255,80,120,.45);animation:unlockPulse 1.6s ease-in-out infinite;';
        if (!document.getElementById('unlock-audio-keyframes')) {
          const k = document.createElement('style');
          k.id = 'unlock-audio-keyframes';
          k.textContent =
            '@keyframes unlockPulse{0%,100%{transform:translate(-50%,0) scale(1);}50%{transform:translate(-50%,0) scale(1.08);} }';
          document.head.appendChild(k);
        }
        btn.addEventListener('click', () => {
          bgmAudio.muted = false;
          const p = bgmAudio.play();
          if (p) {
            p.catch(() => {});
          }
          btn.remove();
          this._audioUnlockBtn = null;
        });
        document.body.appendChild(btn);
        this._audioUnlockBtn = btn;
      }, 3000);
    };
    scheduleAutoplayCheck();

    bgmBtn.addEventListener('click', () => {
      if (bgmKilled) {
        if (!msg.querySelector('.no-music-tip')) {
          msg.insertAdjacentHTML(
            'beforeend',
            `<div class='err no-music-tip' style='margin-top:.35rem;animation:pwdShake .5s;'>我生气了，不给你放歌！</div>`
          );
        } else {
          const tip = msg.querySelector('.no-music-tip');
          tip.style.animation = 'none';
          requestAnimationFrame(() => (tip.style.animation = 'pwdShake .5s'));
        }
        return;
      }
      if (bgmAudio.paused) {
        bgmAudio.play().catch(() => {});
        bgmBtn.classList.remove('muted');
      } else {
        bgmAudio.pause();
        bgmBtn.classList.add('muted');
      }
    });

    // ---- 错误与提示统一区域结构 ----
    function ensureErrorStructure() {
      let wrap = msg.querySelector('.err-wrap');
      if (!wrap) {
        msg.innerHTML = '';
        wrap = document.createElement('div');
        wrap.className = 'err-wrap';
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:.35rem;';
        msg.appendChild(wrap);
      }
      let imgRow = wrap.querySelector('.err-img-row');
      if (!imgRow) {
        imgRow = document.createElement('div');
        imgRow.className = 'err-img-row';
        imgRow.style.cssText = 'display:flex;align-items:center;gap:.25rem;';
        wrap.appendChild(imgRow);
      }
      let lines = wrap.querySelector('.err-lines');
      if (!lines) {
        lines = document.createElement('div');
        lines.className = 'err-lines';
        lines.style.cssText =
          'display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;color:#b3002c;';
        wrap.appendChild(lines);
      }
      return { wrap, imgRow, lines };
    }

    if (!document.getElementById('pwd-error-anim')) {
      const s = document.createElement('style');
      s.id = 'pwd-error-anim';
      s.textContent =
        '@keyframes pwdShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(3px);}30%,50%,70%{transform:translateX(-5px);}40%,60%{transform:translateX(5px);} }';
      document.head.appendChild(s);
    }

    let wrongTimes = 0;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // 用户名非空校验：若未填写则提示并阻止进入
      const username = (form.querySelector('input[name="user"]')?.value || '').trim();
      if (!username) {
        const { lines } = ensureErrorStructure();
        // 显示专用提示
        lines.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = '请填写用户名';
        span.style.cssText = 'animation:pwdShake .38s; color:#b3002c;';
        lines.appendChild(span);
        return; // 阻止继续处理
      }
      // 服务协议勾选校验
      if (agreementInput && !agreementInput.checked) {
        const { lines } = ensureErrorStructure();
        lines.innerHTML = '';
        const span = document.createElement('span');
        span.textContent = '请先阅读并勾选服务协议';
        span.style.cssText = 'animation:pwdShake .48s; color:#b3002c;';
        lines.appendChild(span);
        // 复选框抖动与高亮
        if (agreementWrapper) {
          agreementWrapper.classList.remove('agreement-error-shake');
          void agreementWrapper.offsetWidth; // 强制重绘以重启动画
          agreementWrapper.classList.add('agreement-error-shake', 'agreement-glow');
          setTimeout(() => agreementWrapper.classList.add('fade'), 600);
          setTimeout(() => agreementWrapper.classList.remove('agreement-glow', 'fade'), 1600);
        }
        return;
      }
      const data = new FormData(form);
      const pass = (data.get('pass') || '').trim();
      // 特殊彩蛋：如果输入为她/我的生日，显示彩蛋占位，而不是视作忘了或错误
      if (pass === '20051210' || pass === '20051005') {
        // 记录成就事件：在注册页面输入生日作为密码（供成就系统检测）
        try {
          achievements.recordEvent('scene0:entered_birthday', { pass });
        } catch (e) {}
        // 不计入 wrongTimes，也不停止 BGM
        const eggWrap = document.createElement('div');
        eggWrap.className = 'birthday-egg';
        eggWrap.style.cssText =
          'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.98);padding:18px;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.35);z-index:100000;max-width:92vw;min-width:280px;text-align:center;';
        // 为两个生日分别提供完全独立的模板与行为，便于后续各自扩展
        if (pass === '20051210') {
          // 她 的 彩蛋菜单（独立模板）
          eggWrap.innerHTML = `
            <h3 style='margin:0 0 .5rem;'>为她准备的小角落 ✨</h3>
            <p style='margin:0 0 .6rem;color:#333;'>这是她的特别菜单（占位），包含一些回忆与互动。</p>
            <div style='display:flex;flex-direction:column;gap:.5rem;align-items:center;'>
              <button type='button' class='her-play' style='width:240px;padding:.5rem;'>播放那天的歌（占位）</button>
              <button type='button' class='her-mem' style='width:240px;padding:.5rem;'>打开她的回忆（占位）</button>
              <button type='button' class='her-write' style='width:240px;padding:.5rem;'>写一句话给自己</button>
              <div style='display:flex;gap:.6rem;margin-top:.4rem;justify-content:center;'>
                <button type='button' class='her-close' style='padding:.45rem .8rem;background:#eee;color:#333;border:none;border-radius:6px;'>关闭</button>
              </div>
            </div>
          `;
          document.body.appendChild(eggWrap);
          const removeEgg = () => {
            try {
              eggWrap.remove();
            } catch (e) {}
          };
          eggWrap.querySelector('.her-close').addEventListener('click', () => {
            removeEgg();
          });
          const playBtn = eggWrap.querySelector('.her-play');
          if (playBtn) {
            playBtn.addEventListener('click', () => {
              try {
                if (typeof audioManager?.playSound === 'function') {
                  audioManager.playSound('her_song');
                } else if (bgmAudio) {
                  bgmAudio.play().catch(() => {});
                }
              } catch (e) {
                playBtn.style.transform = 'scale(.98)';
                setTimeout(() => (playBtn.style.transform = ''), 120);
              }
            });
          }
          const memBtn = eggWrap.querySelector('.her-mem');
          if (memBtn) {
            memBtn.addEventListener('click', () => {
              try {
                removeEgg();
                this.ctx.go('timeline');
              } catch (e) {
                removeEgg();
              }
            });
          }
          const writeBtn = eggWrap.querySelector('.her-write');
          if (writeBtn) {
            writeBtn.addEventListener('click', () => {
              (async () => {
                try {
                  const text = prompt('写给自己的一句话（占位）', '');
                  if (!text) return;

                  // small helper to show temporary toasts
                  const makeToast = (msg, opts = {}) => {
                    const t = document.createElement('div');
                    t.textContent = msg;
                    t.style.cssText =
                      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#333;color:#fff;padding:.5rem .8rem;border-radius:8px;z-index:100001;';
                    if (opts.bg) t.style.background = opts.bg;
                    document.body.appendChild(t);
                    return t;
                  };

                  const loading = makeToast('正在发送…');

                  // default endpoint (can be overridden by setting window.EMAIL_SERVER_URL)
                  const base = window.EMAIL_SERVER_URL || 'http://127.0.0.1:3001';
                  const endpoint = base.replace(/\/$/, '') + '/send-egg';

                  const payload = {
                    type: 'to-me',
                    subject: '一句话给自己',
                    message: text,
                  };

                  let res;
                  try {
                    res = await fetch(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                  } catch (err) {
                    loading.remove();
                    const e = makeToast('发送失败（网络错误）', { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 3200);
                    return;
                  }

                  let j;
                  try {
                    j = await res.json();
                  } catch (err) {
                    loading.remove();
                    const e = makeToast('发送失败（非 JSON 响应）', { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 3200);
                    return;
                  }

                  loading.remove();
                  if (j && j.ok) {
                    const info = j.info || {};
                    const h = info.preview
                      ? `已发送（测试邮箱），预览：${info.preview}`
                      : `已发送，id: ${info.messageId || info.accepted}`;
                    const s = makeToast(h, { bg: '#2a8' });
                    setTimeout(() => {
                      try {
                        s.remove();
                      } catch (e) {}
                    }, 7000);
                  } else {
                    const errMsg = (j && j.error) || '发送失败';
                    const e = makeToast(errMsg, { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 4200);
                  }
                } catch (e) {
                  // swallow errors silently but show small hint
                  try {
                    const t = document.createElement('div');
                    t.textContent = '发送出错，请稍后重试';
                    t.style.cssText =
                      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#a33;color:#fff;padding:.5rem .8rem;border-radius:8px;z-index:100001;';
                    document.body.appendChild(t);
                    setTimeout(() => {
                      try {
                        t.remove();
                      } catch (e) {}
                    }, 3200);
                  } catch (e) {}
                }
              })();
            });
          }
          // 仅保留关闭按钮
        } else {
          // 你的生日 的 彩蛋菜单（独立模板）
          eggWrap.innerHTML = `
            <h3 style='margin:0 0 .5rem;'>给你的一点小惊喜 ✨</h3>
            <p style='margin:0 0 .6rem;color:#333;'>这是给你的私人菜单（占位），可以留句感想或查看我们的时刻。</p>
            <div style='display:flex;flex-direction:column;gap:.5rem;align-items:center;'>
              <button type='button' class='you-play' style='width:240px;padding:.5rem;'>播放提示音（占位）</button>
              <button type='button' class='you-mem' style='width:240px;padding:.5rem;'>查看我们的时光（占位）</button>
              <button type='button' class='you-write' style='width:240px;padding:.5rem;'>写一句话给他</button>
              <div style='display:flex;gap:.6rem;margin-top:.4rem;justify-content:center;'>
                <button type='button' class='you-close' style='padding:.45rem .8rem;background:#eee;color:#333;border:none;border-radius:6px;'>关闭</button>
              </div>
            </div>
          `;
          document.body.appendChild(eggWrap);
          const removeEgg = () => {
            try {
              eggWrap.remove();
            } catch (e) {}
          };
          eggWrap.querySelector('.you-close').addEventListener('click', () => {
            removeEgg();
          });
          const playBtn = eggWrap.querySelector('.you-play');
          if (playBtn) {
            playBtn.addEventListener('click', () => {
              try {
                if (typeof audioManager?.playSound === 'function') {
                  audioManager.playSound('ding');
                } else if (bgmAudio) {
                  bgmAudio.play().catch(() => {});
                }
              } catch (e) {
                playBtn.style.transform = 'scale(.98)';
                setTimeout(() => (playBtn.style.transform = ''), 120);
              }
            });
          }
          const memBtn = eggWrap.querySelector('.you-mem');
          if (memBtn) {
            memBtn.addEventListener('click', () => {
              try {
                removeEgg();
                this.ctx.go('timeline');
              } catch (e) {
                removeEgg();
              }
            });
          }
          const writeBtn = eggWrap.querySelector('.you-write');
          if (writeBtn) {
            writeBtn.addEventListener('click', () => {
              (async () => {
                try {
                  const text = prompt('写给他的一句话（占位）', '');
                  if (!text) return;

                  const makeToast = (msg, opts = {}) => {
                    const t = document.createElement('div');
                    t.textContent = msg;
                    t.style.cssText =
                      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#333;color:#fff;padding:.5rem .8rem;border-radius:8px;z-index:100001;';
                    if (opts.bg) t.style.background = opts.bg;
                    document.body.appendChild(t);
                    return t;
                  };

                  const loading = makeToast('正在发送…');
                  const base = window.EMAIL_SERVER_URL || 'http://127.0.0.1:3001';
                  const endpoint = base.replace(/\/$/, '') + '/send-egg';
                  const payload = {
                    type: 'to-him',
                    subject: '一句话给他',
                    message: text,
                  };

                  let res;
                  try {
                    res = await fetch(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                  } catch (err) {
                    loading.remove();
                    const e = makeToast('发送失败（网络错误）', { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 3200);
                    return;
                  }

                  let j;
                  try {
                    j = await res.json();
                  } catch (err) {
                    loading.remove();
                    const e = makeToast('发送失败（非 JSON 响应）', { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 3200);
                    return;
                  }

                  loading.remove();
                  if (j && j.ok) {
                    const info = j.info || {};
                    const h = info.preview
                      ? `已发送（测试邮箱），预览：${info.preview}`
                      : `已发送，id: ${info.messageId || info.accepted}`;
                    const s = makeToast(h, { bg: '#2a8' });
                    setTimeout(() => {
                      try {
                        s.remove();
                      } catch (e) {}
                    }, 7000);
                  } else {
                    const errMsg = (j && j.error) || '发送失败';
                    const e = makeToast(errMsg, { bg: '#a33' });
                    setTimeout(() => {
                      try {
                        e.remove();
                      } catch (e) {}
                    }, 4200);
                  }
                } catch (e) {
                  try {
                    const t = document.createElement('div');
                    t.textContent = '发送出错，请稍后重试';
                    t.style.cssText =
                      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#a33;color:#fff;padding:.5rem .8rem;border-radius:8px;z-index:100001;';
                    document.body.appendChild(t);
                    setTimeout(() => {
                      try {
                        t.remove();
                      } catch (e) {}
                    }, 3200);
                  } catch (e) {}
                }
              })();
            });
          }
          // 仅保留关闭按钮
        }
        return;
      }

      if (pass === '20241007') {
        msg.innerHTML = `<span class='ok'>验证成功！那天开始的一切，都继续写在下面的故事里 ❤</span>`;
        // 记录全局注册成功事件（供成就计时器使用）
        try {
          achievements.recordEvent('player:registered', { pass });
        } catch (e) {}
        setTimeout(() => this.ctx.go('intro'), 800);
      } else {
        wrongTimes++;
        if (!bgmKilled) {
          audioManager.stopBGM('0');
          bgmKilled = true;
          bgmBtn.classList.add('muted');
        }
        const { imgRow, lines } = ensureErrorStructure();
        if (wrongTimes < 5) {
          const angryLines = [
            '不是你干什么呢？！',
            '好好填！不许乱填！',
            '溜溜！不许这样！',
            '再填错我真生气了！',
          ];
          // 轮播：每次只显示当前这一条，替换上一条
          lines.innerHTML = '';
          const span = document.createElement('span');
          span.textContent = angryLines[(wrongTimes - 1) % angryLines.length];
          span.style.cssText = 'animation:pwdShake .5s;';
          lines.appendChild(span);
        } else if (wrongTimes === 5) {
          if (!imgRow.querySelector('.wrong-cry')) {
            const cry = document.createElement('img');
            cry.src = './assets/images/cry.png';
            cry.alt = 'cry';
            cry.className = 'wrong-cry';
            cry.style.cssText = 'width:70px;height:70px;animation:shakeCry .6s ease;';
            imgRow.appendChild(cry);
          }
          // 隐藏之前显示的生气文字区域，避免与哭脸同时出现
          try {
            const lines = imgRow.closest('.err-wrap')?.querySelector('.err-lines');
            if (lines) {
              lines.innerHTML = '';
              lines.style.display = 'none';
            }
          } catch (e) {}
        } else if (wrongTimes >= 6) {
          // 恢复错误文字容器的显示（可能在第5次时被隐藏），确保退出文本可见
          try {
            if (lines && lines.style) {
              lines.style.display = '';
            }
          } catch (e) {}
          const bye = document.createElement('span');
          bye.textContent = '……我不跟你玩了，再见！';
          lines.appendChild(bye);
          // 记录成就事件：连续 6 次密码错误
          try {
            achievements.recordEvent('scene0:failed_six', { count: wrongTimes });
          } catch (e) {}
          // 第6次错误：禁用整个页面的交互，等待成就 '0-2' 已解锁后退出。
          (function waitForAchievementThenExit() {
            const timeout = 4500; // ms
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              setTimeout(() => {
                try {
                  window.close();
                } catch (e) {}
                location.href = 'about:blank';
              }, 900);
            };
            // 在页面上放一个透明覆盖层以阻止所有点击交互
            try {
              if (!document.getElementById('page-disable-overlay')) {
                const ov = document.createElement('div');
                ov.id = 'page-disable-overlay';
                ov.style.cssText =
                  'position:fixed;left:0;top:0;width:100%;height:100%;z-index:100000;background:transparent;cursor:default;pointer-events:auto;';
                document.body.appendChild(ov);
              }
            } catch (e) {}

            // 若成就 '0-2' 已存在，立即退出（无需等待）
            let already = false;
            try {
              already =
                achievements &&
                typeof achievements.getUnlocked === 'function' &&
                achievements.getUnlocked().has('0-2');
            } catch (e) {
              already = false;
            }
            if (already) {
              finish();
              return;
            }

            const onUnlock = (ev) => {
              try {
                const did = String(ev.detail?.id);
                if (did === '0-2') {
                  window.removeEventListener('achievement:unlocked', onUnlock);
                  finish();
                }
              } catch (e) {}
            };
            window.addEventListener('achievement:unlocked', onUnlock);
            // 兜底超时
            setTimeout(() => {
              try {
                window.removeEventListener('achievement:unlocked', onUnlock);
              } catch (e) {}
              finish();
            }, timeout);
          })();
        }
      }
    });
    // “我忘了”按钮：1~4 次依次累加 angry.png，5 次显示 cry.png 并禁用按钮
    this._forgotClicks = 0;
    forgotBtn.addEventListener('click', () => {
      if (forgotBtn.disabled) return;
      this._forgotClicks++;
      if (!bgmKilled) {
        audioManager.stopBGM('0');
        bgmKilled = true;
        bgmBtn.classList.add('muted');
      }
      // 使用统一结构，避免后续密码错误覆盖表情
      const { imgRow } = ensureErrorStructure();
      // 查找或创建忘记表情容器
      let faceGroup = imgRow.querySelector('.forgot-faces');
      if (!faceGroup) {
        faceGroup = document.createElement('div');
        faceGroup.className = 'forgot-faces';
        faceGroup.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:wrap;';
        imgRow.appendChild(faceGroup);
      }
      if (this._forgotClicks < 5) {
        // 1~4 次：用 N 个 angry 图，先清空再生成，保持数量与点击次数一致
        faceGroup.innerHTML = '';
        for (let i = 0; i < this._forgotClicks; i++) {
          const im = document.createElement('img');
          im.src = './assets/images/angry.png';
          im.alt = 'angry';
          im.style.cssText = 'width:48px;height:48px;margin:2px;animation:pop .4s ease;';
          faceGroup.appendChild(im);
        }
      } else {
        // 第5次：移除 angry 组，添加哭脸（靠右不会影响密码错误时的行）
        faceGroup.remove();
        if (!imgRow.querySelector('.forgot-cry')) {
          const cry = document.createElement('img');
          cry.src = './assets/images/cry.png';
          cry.alt = 'cry';
          cry.className = 'forgot-cry';
          cry.style.cssText =
            'width:70px;height:70px;animation:shakeCry .6s ease;margin-left:auto;';
          imgRow.appendChild(cry);
        }
        forgotBtn.disabled = true;
        forgotBtn.classList.add('disabled');
        forgotBtn.textContent = '不许忘！！！';
        forgotBtn.classList.add('shake-once', 'flash-red');
        setTimeout(() => forgotBtn.classList.remove('shake-once'), 600);
        const passInput = form.querySelector('input[name="pass"]');
        setTimeout(() => {
          if (!passInput.value.trim()) {
            // 替换 label 的分片文本为“快输入！”保持原逐字动画延迟结构
            const passLabel = passInput.closest('.form-control')?.querySelector('label');
            if (passLabel) {
              passLabel.innerHTML = '';
              const txt = '快输入！';
              for (let i = 0; i < txt.length; i++) {
                const span = document.createElement('span');
                span.textContent = txt[i];
                span.style.transitionDelay = i * 80 + 'ms';
                passLabel.appendChild(span);
              }
            } else {
              // 兜底：仍使用 placeholder
              passInput.placeholder = '快输入！';
            }
          }
        }, 2000);
        // 成就触发点：当忘记按钮达到第5次并显示哭脸时，记录事件供成就检测
        try {
          achievements.recordEvent('scene0:forgot_cry', { count: this._forgotClicks });
        } catch (e) {}
      }
    });
    // 简单弹出/哭泣动画（内联追加一次）
    if (!document.getElementById('register-emoji-anim')) {
      const style = document.createElement('style');
      style.id = 'register-emoji-anim';
      style.textContent = `@keyframes pop{0%{transform:scale(.3);opacity:0;}60%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);} }@keyframes shakeCry{0%,100%{transform:translateX(0);}25%{transform:translateX(-4px);}50%{transform:translateX(4px);}75%{transform:translateX(-3px);} }@keyframes btnShake{0%,100%{transform:translateX(0);}20%,60%{transform:translateX(-5px);}40%,80%{transform:translateX(5px);} }@keyframes flashRed{0%,100%{box-shadow:0 0 0 0 rgba(255,0,60,.0);}50%{box-shadow:0 0 0 4px rgba(255,0,60,.55);} }@keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} } .shake-once{animation:btnShake .6s ease;} .flash-red{animation:flashRed 1.3s ease-in-out infinite alternate; background:#ff5f7f !important; color:#fff !important;}`;
      document.head.appendChild(style);
    }
    this.ctx.rootEl.appendChild(el);

    // DEBUG: 场景跳转按钮绑定（开发期使用）
    const debugPanel = el.querySelector('.debug-panel');
    if (debugPanel) {
      debugPanel.querySelectorAll('button[data-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-jump');
          // 跳场景前可选择是否写入注册标记，确保后续流程不被卡住
          // （保留：未来可在此添加跳转前校验）
          this.ctx.go(target);
        });
      });
      // DEV: 清空成就数据按钮绑定（发布前删除）
      const clearBtn = debugPanel.querySelector('button[data-clear-achievements]');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          try {
            if (!confirm('确定要清空本地成就数据吗？该操作不可恢复（仅用于开发调试）。')) return;
            // 优先调用成就模块清空接口
            try {
              if (typeof achievements?.clearAll === 'function') {
                achievements.clearAll();
              } else {
                const KEY = 'birthday_unlocked_achievements_v1';
                try {
                  localStorage.removeItem(KEY);
                } catch (e) {}
              }
            } catch (e) {}
            // 显示短提示
            const t = document.createElement('div');
            t.textContent = '已清空成就并刷新页面';
            t.style.cssText =
              'position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#111;color:#fff;padding:.45rem .8rem;border-radius:8px;z-index:100001;';
            document.body.appendChild(t);
            setTimeout(() => {
              try {
                t.remove();
              } catch (e) {}
            }, 1200);
            setTimeout(() => {
              location.reload();
            }, 900);
          } catch (e) {
            console.warn('clear achievements failed', e);
            alert('清空失败，请在控制台查看错误');
          }
        });
      }
      // DEV-ONLY END
    }
  }

  async exit() {
    // 离开注册场景时确保背景音乐淡出停止，防止串场
    // 退出时同样使用正确的 key '0'
    audioManager.stopBGM('0', { fadeOut: 600 });
    if (this._audioUnlockBtn) {
      try {
        this._audioUnlockBtn.remove();
      } catch (e) {}
      this._audioUnlockBtn = null;
    }
  }
}
