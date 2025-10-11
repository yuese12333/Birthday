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
    // toast 队列，保证不会重叠显示
    this._toastQueue = [];
    this._toastBusy = false;
    // 注册时间（由场景注册成功时触发 player:registered 事件写入）
    this._registeredAt = null;
    // 极速通关时间窗口（ms），默认 10 分钟
    this.quickFinishWindow = 10 * 60 * 1000;
    // 成就描述初始可见性默认值（可通过 setDefaultDescriptionVisible 修改）
    this._defaultDescriptionVisible = true;
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
    // 入队并尝试显示
    this._toastQueue.push(meta);
    this._drainToastQueue();
  }

  _drainToastQueue(){
    if(this._toastBusy) return;
    const next = this._toastQueue.shift();
    if(!next) return;
    this._toastBusy = true;
    try{
      const c = document.getElementById('ach-toast-container');
      if(!c){ this._toastBusy = false; return; }
      const el = document.createElement('div');
      el.className = 'ach-toast';
      el.style.fontSize = '13px';
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.transform = 'translateY(6px)';
      const title = next.title || '成就解锁';
      const desc = next.desc || '';
      // 使用图片图标替代文本星号，保持可访问性
      const iconHtml = `<div class="ach-icon"><img src='./assets/images/unlock.png' alt='成就已解锁' style='width:100%;height:100%;object-fit:cover' /></div>`;
      el.innerHTML = `
        ${iconHtml}
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
      const duration = Math.max(2800, next.duration || 3000);
      setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
        setTimeout(()=>{ try{ el.remove(); }catch(e){} this._toastBusy = false; this._drainToastQueue(); }, 300);
      }, duration);
    }catch(e){ console.warn('ach toast err', e); this._toastBusy = false; this._drainToastQueue(); }
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
  const m = Object.assign({ descriptionVisible: this._defaultDescriptionVisible }, (meta||{}));
    this.achievements.set(id, {meta: m, predicate});
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
        // 标记解锁后可见描述
        try{ item.meta.descriptionVisible = true; }catch(e){}
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
    // 记录注册时间供极速通关判定
    try{ if(name === 'player:registered'){ this._registeredAt = ev.ts; } }catch(e){}
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
    try{ meta.descriptionVisible = true; }catch(e){}
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

  // 返回注册时间（时间戳 ms），若未注册则返回 null
  getRegisteredAt(){ return this._registeredAt || null; }

  // 返回从注册到现在或到指定时间的已用毫秒，若未注册返回 null
  getElapsedSinceRegistered(whenTs){
    if(!this._registeredAt) return null;
    const end = (typeof whenTs === 'number') ? whenTs : Date.now();
    return Math.max(0, end - this._registeredAt);
  }

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

  // 返回所有已注册成就的列表，包含 id, meta, unlocked(boolean)
  listRegistered(){
    const out = [];
    for(const [id, item] of this.achievements.entries()){
      out.push({ id: String(id), meta: Object.assign({}, item.meta), unlocked: this.unlocked.has(id) });
    }
    return out;
  }

  // 设置全局默认的 descriptionVisible 值（仅影响后续注册的成就）
  setDefaultDescriptionVisible(flag){ this._defaultDescriptionVisible = !!flag; }

  // 手动设置某个已注册成就的 descriptionVisible 值
  setDescriptionVisible(id, flag){
    try{
      const item = this.achievements.get(id);
      if(!item) return false;
      item.meta.descriptionVisible = !!flag;
      return true;
    }catch(e){ return false; }
  }
}

export const achievements = new Achievements();
export default achievements;

// 成就 0 —— 在注册页面输入生日密码
// 成就 0-0 —— 在注册页面输入生日密码
achievements.register('0-0', {
  title: '生日密码',
  desc: '这年头谁还用生日当密码呀',
  descriptionVisible: false
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:entered_birthday' && ev.payload && (ev.payload.pass === '20051210' || ev.payload.pass === '20051005'));
});

// 成就 0-1：在注册页面多次点击“我忘了”并触发哭脸
achievements.register('0-1', {
  title: '记性真差',
  desc: '你是不是故意的？',
  descriptionVisible: false
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:forgot_cry');
});

// 成就 0-2：密码错误达到 6 次（连续错误导致退出）
achievements.register('0-2', {
  title: '执着的尝试',
  desc: '好奇心不仅会害死猫，还会气死我',
  descriptionVisible: false
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene0:failed_six');
});

// 成就 2-0：第二幕超级学霸（未使用提示、未跳过、未出现错误宠溺）
achievements.register('2-0', {
  title: '超级学霸',
  desc: '考试一次过，你就是学霸！',
  descriptionVisible: true
}, (events)=>{
  try{
    const e = events.find(ev => ev && ev.name === 'scene2:exam_summary');
    if(!e || !e.payload) return false;
    const { hintsUsed=0, skippedQuestions=0, pamperedWrongCount=0, totalQuestions=0 } = e.payload;
    return totalQuestions>0 && hintsUsed===0 && skippedQuestions===0 && pamperedWrongCount===0;
  }catch(e){ return false; }
});

// 成就 2-1：本次考试全部由宠溺跳过通过
achievements.register('2-1', {
  title: '我帮你做啦',
  desc: '本次考试每题均通过宠溺跳过获得分数',
  descriptionVisible: false
}, (events)=>{
  try{
    const e = events.find(ev => ev && ev.name === 'scene2:exam_summary');
    if(!e || !e.payload) return false;
    const { skippedQuestions=0, totalQuestions=0 } = e.payload;
    return totalQuestions>0 && skippedQuestions === totalQuestions;
  }catch(e){ return false; }
});

// 成就 2-2：本次考试全部靠第三次提示（自动判定）完成
achievements.register('2-2', {
  title: '被提示包圆',
  desc: '每题都靠第三次提示自动通过',
  descriptionVisible: false
}, (events)=>{
  try{
    const e = events.find(ev => ev && ev.name === 'scene2:exam_summary');
    if(!e || !e.payload) return false;
    const { autoHintCount=0, totalQuestions=0 } = e.payload;
    return totalQuestions>0 && autoHintCount === totalQuestions;
  }catch(e){ return false; }
});

// 成就 2-3：本次考试全部为宠溺错误（全部答错走宠溺逻辑）
achievements.register('2-3', {
  title: '错误也可爱',
  desc: '每题都通过宠溺错误的方式完成',
  descriptionVisible: false
}, (events)=>{
  try{
    const e = events.find(ev => ev && ev.name === 'scene2:exam_summary');
    if(!e || !e.payload) return false;
    const { pamperedWrongCount=0, totalQuestions=0 } = e.payload;
    return totalQuestions>0 && pamperedWrongCount === totalQuestions;
  }catch(e){ return false; }
});

// 成就 3-0：数织高手——完成第 3 幕的最后一张数织图且未使用提示
achievements.register('3-0', {
  title: '数织高手',
  desc: '在数织的最后一关中未使用提示完成拼图',
  descriptionVisible: true
}, (events)=>{
  try{
    const e = events.find(ev => ev && ev.name === 'scene3:final_complete');
    if(!e || !e.payload) return false;
    const { hintUse=0 } = e.payload;
    return hintUse === 0;
  }catch(e){ return false; }
});

// 成就 8-0：进入第八幕（终章）——完成游戏
achievements.register('8-0', {
  title: '完成旅程',
  desc: '到达终章，完成整个旅程',
  descriptionVisible: true
}, (events)=>{
  return events.some(ev => ev && ev.name === 'scene8:entered');
});

// 成就 8-1：在注册后 N 毫秒内通关（默认 10 分钟，可通过 achievements.quickFinishWindow 调整）
achievements.register('8-1', {
  title: '极速通关',
  desc: '在注册后十分钟内完成旅程',
  descriptionVisible: true
}, (events)=>{
  // 若没有记录注册时间，则无法判定
  try{
    const start = achievements._registeredAt;
    if(!start) return false;
    // 寻找进入终章事件时间戳
    const e = events.find(ev => ev && ev.name === 'scene8:entered');
    if(!e) return false;
    return (e.ts - start) <= achievements.quickFinishWindow;
  }catch(e){ return false; }
});
