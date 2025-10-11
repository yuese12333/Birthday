// 成就管理器 - 轻量且无外部依赖
// 职责：
// - 注册成就：使用 id / meta / predicate 注册成就条件
// - 记录事件：记录可能触发成就检测的应用事件
// - 持久化：将已解锁的成就保存到 localStorage
// - 通知：当成就达成时显示小弹窗（toast）提示

import { audioManager } from './audioManager.js';

const STORAGE_KEY = 'birthday_unlocked_achievements_v1';

class Achievements {
  constructor(){
  this.achievements = new Map(); // id -> {meta,predicate}
  this.unlocked = new Set();
  this.events = []; // 记录历史事件，供 predicate 使用判断条件
  this.bus = null; // 可选的事件总线（EventBus），用于接入项目全局事件
    this._load();
    this._ensureToastContainer();
  }

  _ensureToastContainer(){
    if(document.getElementById('ach-toast-container')) return;
    const c = document.createElement('div');
    c.id = 'ach-toast-container';
    c.style.position = 'fixed';
    c.style.right = '16px';
    c.style.bottom = '16px';
    c.style.zIndex = '99999';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '8px';
    document.body.appendChild(c);
  }

  _showToast(meta){
    try{
      const c = document.getElementById('ach-toast-container');
      if(!c) return;
      const el = document.createElement('div');
      el.className = 'ach-toast';
       // visual styles are provided by CSS (.ach-toast/.ach-icon)
       // keep only behavioral inline styles (transitions/visibility)
       el.style.fontSize = '13px';
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.transform = 'translateY(6px)';
       // include an icon slot so CSS (.ach-icon) rules apply
       const title = meta.title || '成就解锁';
       const desc = meta.desc || '';
       el.innerHTML = `
         <div class="ach-icon">★</div>
         <div class="ach-body">
           <strong>${title}</strong>
           <div>${desc}</div>
         </div>
       `;
      c.appendChild(el);
      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
        setTimeout(()=> el.remove(), 300);
      }, Math.max(2800, meta.duration || 3000));
    }catch(e){ console.warn('ach toast err', e); }
  }

  _save(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
    }catch(e){ console.warn('ach save err', e); }
  }

  _load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)) arr.forEach(id=> this.unlocked.add(id));
    }catch(e){ console.warn('ach load err', e); }
  }

  register(id, meta, predicate){
    if(!id) throw new Error('achievement id required');
    if(this.achievements.has(id)){
      console.warn('achievement already registered:', id);
      return;
    }
    // predicate 接口： (events, recordEvent) => boolean | Promise<boolean>
    // events 为当前已记录的事件数组，recordEvent 可用于在 predicate 内部添加合成事件
    this.achievements.set(id, {meta:meta||{}, predicate});
    // 注册后稍微延迟进行一次检查（以便捕获已经满足的条件）
    setTimeout(()=> this._checkOne(id), 20);
  }

  async _checkOne(id){
    // 若已解锁则跳过
    if(this.unlocked.has(id)) return false;
    const item = this.achievements.get(id);
    if(!item || typeof item.predicate !== 'function') return false;
    try{
      // 将事件副本传入 predicate，并提供 recordEvent 的回调
      const res = item.predicate(this.events.slice(), (ev)=> this._recordForPredicate(ev));
      const ok = (res instanceof Promise) ? await res : res;
      if(ok){
        this.unlocked.add(id);
        this._save();
        // 使用 audioManager 播放成就音效（遵循全局静音设置）
        try{ if(audioManager && typeof audioManager.playSound === 'function') audioManager.playSound('./assets/audio/Achievement.wav', { volume: 0.35 }); }catch(e){}
        this._showToast(item.meta);
        // 全局派发已解锁事件，方便页面或其它模块监听（DEV-friendly）
        try{ window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: { id: String(id), meta: item.meta } })); }catch(e){}
        return true;
      }
    }catch(e){ console.warn('achievement check err', e); }
    return false;
  }

  // 供 predicate 内部调用，用于添加合成/辅助事件到事件队列中
  _recordForPredicate(ev){
    this.events.push(ev);
    if(this.events.length > 200) this.events.shift();
  }

  // 应用层调用：记录一个事件并触发成就检测
  recordEvent(name, payload){
    const ev = { name, payload, ts: Date.now() };
    this.events.push(ev);
    if(this.events.length > 200) this.events.shift();
    // 快速触发所有已注册成就的检查（异步内部处理）
    for(const id of this.achievements.keys()){
      this._checkOne(id);
    }
    // 若已挂接到事件总线，则也向总线广播一个成就事件
    if(this.bus && typeof this.bus.emit === 'function'){
      try{ this.bus.emit('achievement:event', ev); }catch(e){}
    }
  }

  // 强制解锁某个成就（可用于测试或管理员触发）
  unlock(id){
    if(this.unlocked.has(id)) return false;
    if(!this.achievements.has(id)){
      console.warn('unlock unknown achievement:', id);
      this.unlocked.add(id); // 仍然持久化未知 id，以免重复触发
      this._save();
      return true;
    }
    this.unlocked.add(id);
    this._save();
    const meta = this.achievements.get(id).meta;
    try{ if(audioManager && typeof audioManager.playSound === 'function') audioManager.playSound('./assets/audio/Achievement.wav', { volume: 1.0 }); }catch(e){}
    this._showToast(meta);
    return true;
  }

  // 清空所有已解锁成就（供开发调试使用）
  clearAll(){
    try{
      this.unlocked.clear();
      this.events = [];
      try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
      // 移除页面上残留的 toast 容器内容
      const c = document.getElementById('ach-toast-container');
      if(c){ c.innerHTML = ''; }
      return true;
    }catch(e){ console.warn('ach clearAll err', e); return false; }
  }

  getUnlocked(){ return new Set(this.unlocked); }

  // 将成就管理器挂接到项目的事件总线（若有），方便自动转发全局事件
  attachToEventBus(bus){
    this.bus = bus;
    if(!bus) return;
    if(typeof bus.on === 'function'){
      // 示例：监听全局事件并转发到 recordEvent
      try{
        bus.on('app:event', (ev)=> this.recordEvent(ev.name, ev.payload));
      }catch(e){/* 尽力而为，不阻塞主流程 */}
    }
  }
}

export const achievements = new Achievements();
export default achievements;

// 成就 0 —— 在注册页面输入生日密码
// 成就 0-0 —— 在注册页面输入生日密码
achievements.register('0-0', {
  title: '发现生日彩蛋',
  desc: '在注册页面输入了特别的生日作为密码（发现了彩蛋）'
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:entered_birthday' && ev.payload && (ev.payload.pass === '20051210' || ev.payload.pass === '20051005'));
});

// 成就 0-1：在注册页面多次点击“我忘了”并触发哭脸
achievements.register('0-1', {
  title: '记性真差',
  desc: '在注册页多次忘记，直到显示哭脸并被禁用'
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:forgot_cry');
});

// 成就 0-2：密码错误达到 6 次（连续错误导致退出）
achievements.register('0-2', {
  title: '执着的尝试',
  desc: '连续多次尝试错误密码直到被动退出'
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:failed_six');
});
