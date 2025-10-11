import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { achievements } from '../core/achievements.js';

function formatDuration(ms){
  const total = Math.floor(ms/1000);
  const s = total % 60;
  const m = Math.floor((total/60)) % 60;
  const h = Math.floor(total/3600);
  const pad = (n)=> String(n).padStart(2,'0');
  if(h>0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Scene8Final 终章（占位）
 * 作用：集中展示最终祝福 / 旅程结束文案。
 * 后续可在此：
 *  - 汇总前面场景统计（答题、协同、成就）
 *  - 展示动态生成的个性化段落 / 图片拼贴 / 流光动画
 *  - 添加“再走一遍旅程”或“下载纪念图”功能
 */
export class Scene8Final extends BaseScene {
  async init(){ await super.init(); }
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-final placeholder';
    el.innerHTML = `
      <h1>终章：生日快乐 🎉</h1>
      <p class='final-line' id='finish-time-line'>通关用时：计算中...</p>
      <p class='final-line'>这一段回忆旅程到这里暂告一段落，但我们正在写的真实日常还在继续。</p>
      <p class='final-line'>谢谢你一直愿意被我认真地喜欢，也谢谢未来的我们继续携带耐心与温柔。</p>
      <div class='final-actions'>
        <button class='replay' data-debounce='800'>重新开始旅程</button>
        <button class='view-ach' style='margin-left:.6rem;'>查看成就</button>
      </div>
      <p class='note'>( 占位终章：后续将加入统计汇总 / 个性化语料 / 成就展示 / 图片拼贴 )</p>
    `;

    // 统一使用基类提供的文字不可选封装
    this.applyNoSelect(el);

    try { audioManager.playSceneBGM('7',{ loop:true, volume:0.55, fadeIn:800 }); } catch(e){}
    // 标记：已进入终章（全局通关印记），保存在 localStorage 中
    try{ localStorage.setItem('birthday_completed_mark', 'true'); }catch(e){}
    el.querySelector('.replay').addEventListener('click',()=>{
      // 点击重新开始旅程时清除通关印记并回到注册页
      try{ localStorage.setItem('birthday_completed_mark', 'false'); }catch(e){}
      this.ctx.go('register');
    });
    // 如果已通关印记为 true，显示跳转到第1-7幕的按钮
    try{
      const completed = (()=>{ try{ return localStorage.getItem('birthday_completed_mark') === 'true'; }catch(e){ return false; } })();
      if(completed){
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'goto-previous';
        jumpBtn.style.marginLeft = '.6rem';
        jumpBtn.textContent = '继续探索 →';
        // 插入到 final-actions 中
        const actions = el.querySelector('.final-actions');
        if(actions) actions.appendChild(jumpBtn);
        jumpBtn.addEventListener('click', ()=> openJumpPanel(this));
      }
    }catch(e){}
    this.ctx.rootEl.appendChild(el);
    // 计算并显示自注册以来的用时（若有）
    try{
      const elapsed = achievements.getElapsedSinceRegistered(Date.now());
      const line = el.querySelector('#finish-time-line');
      if(elapsed === null){ line.textContent = '通关用时：未记录注册时间'; }
      else {
        const fmt = formatDuration(elapsed);
        line.textContent = `通关用时：${fmt}`;
      }
    }catch(e){ /* ignore */ }
    // 记录进入终章（第八幕），供成就判定使用
    try{ achievements.recordEvent('scene8:entered', { ts: Date.now() }); }catch(e){}
    // 绑定查看成就按钮
    try{
      const viewBtn = el.querySelector('.view-ach');
      if(viewBtn){ viewBtn.addEventListener('click', ()=> openAchievementsModal() ); }
    }catch(e){}
  }
  async exit(){ audioManager.stopBGM('7',{ fadeOut:600 }); }
}

function openAchievementsModal(){
  // 防止重复打开
  if(document.getElementById('ach-modal-overlay')) return;
  // inject styles once
  if(!document.getElementById('ach-modal-styles')){
    const s = document.createElement('style'); s.id = 'ach-modal-styles';
    s.textContent = `
      .ach-modal-overlay{position:fixed;left:0;top:0;width:100%;height:100%;background:rgba(6,10,15,0.6);z-index:100100;display:flex;align-items:center;justify-content:center;padding:32px;}
      .ach-modal-panel{max-width:820px;width:100%;max-height:86vh;overflow:auto;background:linear-gradient(180deg,#fff,#fbfbff);border-radius:12px;padding:18px;box-shadow:0 18px 50px rgba(8,10,30,0.5);border:1px solid rgba(0,0,0,0.06);font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;}
      .ach-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .ach-modal-title{font-size:1.15rem;margin:0;color:#111}
      .ach-close-btn{background:transparent;border:none;padding:.45rem .6rem;border-radius:8px;cursor:pointer;color:#444;background:#f3f4f6}
      .ach-list{display:flex;flex-direction:column;gap:.6rem;padding:4px}
      .ach-item{display:flex;gap:.9rem;align-items:flex-start;padding:.7rem;border-radius:10px;border:1px solid rgba(15,20,30,0.04);background:linear-gradient(180deg,#ffffff,#fcfcff)}
      .ach-item.unlocked{background:linear-gradient(90deg,#fffaf0,#fff7e6);border-color:rgba(255,180,0,0.15)}
      .ach-icon{width:40px;height:40px;flex:0 0 40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
      .ach-icon.locked{background:#f0f0f3;color:#bbb}
      .ach-icon.unlocked{background:linear-gradient(180deg,#fff4d6,#fff0b8);color:#ff9800;box-shadow:0 6px 18px rgba(255,168,38,0.12)}
      .ach-body{flex:1}
      .ach-title{font-weight:600;color:#111}
      .ach-desc{color:#666;margin-top:6px;font-size:0.95rem;line-height:1.35}
      @media (max-width:720px){ .ach-modal-panel{padding:14px;} .ach-icon{width:36px;height:36px} }
    `; document.head.appendChild(s);
  }
  const overlay = document.createElement('div');
  overlay.id = 'ach-modal-overlay';
  overlay.className = 'ach-modal-overlay';
  const panel = document.createElement('div');
  panel.className = 'ach-modal-panel';
  panel.innerHTML = `<div class='ach-modal-header'><h3 class='ach-modal-title'>成就</h3><button id='ach-modal-close' class='ach-close-btn' aria-label='关闭'>关闭</button></div><div id='ach-list' class='ach-list'></div>`;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  const listEl = panel.querySelector('#ach-list');
  const items = achievements.listRegistered();
  // 按 id 排序以保证稳定顺序（可按需调整）
  items.sort((a,b)=> a.id.localeCompare(b.id));
  items.forEach(it=>{
    const row = document.createElement('div');
    row.className = 'ach-item' + (it.unlocked? ' unlocked':'');
    const icon = document.createElement('div');
    icon.className = 'ach-icon ' + (it.unlocked? 'unlocked':'locked');
    // 使用图片展示锁定/解锁状态，保留类名以复用样式
    const img = document.createElement('img');
    img.src = it.unlocked ? './assets/images/unlock.png' : './assets/images/lock.png';
    img.alt = it.unlocked ? '已达成' : '未达成';
    img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
    icon.appendChild(img);
    const body = document.createElement('div'); body.className = 'ach-body';
    if(it.unlocked){
      body.innerHTML = `<div class='ach-title'>${escapeHtml(it.meta.title||it.id)}</div><div class='ach-desc'>${escapeHtml(it.meta.desc||'')}</div>`;
    } else {
      if(it.meta && it.meta.descriptionVisible){
        body.innerHTML = `<div class='ach-title' style='color:#666'>${escapeHtml(it.meta.title||'未知成就')}</div><div class='ach-desc' style='color:#888'>${escapeHtml(it.meta.desc||'暂无描述')}</div>`;
      } else {
        body.innerHTML = `<div class='ach-title' style='color:#bbb'>锁定的成就</div>`;
      }
    }
    row.appendChild(icon); row.appendChild(body); listEl.appendChild(row);
  });
  panel.querySelector('#ach-modal-close').addEventListener('click', ()=>{ try{ overlay.remove(); }catch(e){} });
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function openJumpPanel(sceneInstance){
  // 防重
  if(document.getElementById('jump-panel-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'jump-panel-overlay';
  overlay.style.position = 'fixed'; overlay.style.left='0'; overlay.style.top='0'; overlay.style.width='100%'; overlay.style.height='100%'; overlay.style.background='rgba(0,0,0,0.45)'; overlay.style.zIndex='100200'; displayFlexCenter(overlay);
  const panel = document.createElement('div');
  panel.style.background='#fff'; panel.style.padding='18px'; panel.style.borderRadius='10px'; panel.style.maxWidth='520px'; panel.style.width='92%'; panel.style.boxShadow='0 12px 40px rgba(0,0,0,0.3)';
  panel.innerHTML = `<h3 style='margin-top:0'>跳转到第1-7幕</h3><div id='jump-list' style='display:flex;flex-wrap:wrap;gap:.5rem'></div><div style='margin-top:.8rem;text-align:right'><button id='jump-close' style='padding:.4rem .6rem'>关闭</button></div>`;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  const list = panel.querySelector('#jump-list');
  const sceneIds = ['intro','exam','timeline','confession','date','scarf','future'];
  sceneIds.forEach((id, idx)=>{
    const b = document.createElement('button');
    b.textContent = `第${idx+1}幕`;
    b.style.padding = '.5rem .7rem';
    b.addEventListener('click', ()=>{
      try{ overlay.remove(); }catch(e){}
      try{ sceneInstance.ctx.go(id); }catch(e){
        // 兜底：若路由名不同，可尝试使用 'register' 或 'timeline' 之类的保底跳转
        try{ sceneInstance.ctx.go('register'); }catch(e2){}
      }
    });
    list.appendChild(b);
  });
  panel.querySelector('#jump-close').addEventListener('click', ()=>{ try{ overlay.remove(); }catch(e){} });
}

function displayFlexCenter(el){ el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center'; }
