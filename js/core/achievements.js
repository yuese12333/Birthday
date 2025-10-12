// 成就管理器 - 轻量且无外部依赖
// 职责：
// - 注册成就：使用 id / meta / predicate 注册成就条件
// - 记录事件：记录可能触发成就检测的应用事件
// - 持久化：将已解锁的成就保存到 localStorage
// - 通知：当成就达成时显示小弹窗（toast）提示

import { audioManager } from './audioManager.js';

const STORAGE_KEY = 'birthday_unlocked_achievements_v1';
const RECENT_TOASTS_KEY = 'birthday_recent_toasts_v1';

class Achievements {
  constructor() {
    this.achievements = new Map(); // id -> {meta,predicate}
    this.unlocked = new Set();
    this.events = []; // 记录历史事件，供 predicate 使用判断条件
    this.bus = null; // 可选的事件总线（EventBus），用于接入项目全局事件
    this._load();
    this._ensureToastContainer();
    // toast 队列，保证不会重叠显示
    this._toastQueue = [];
    this._toastBusy = false;
    // 正在检查的成就 id 集合，防止并发检查导致重复解锁
    this._checking = new Set();
    // 最近显示过的吐司 id 集合，用于短期去重
    this._recentToasts = new Set();
    // 尝试加载之前的短期吐司记录（持久化），以便跨页面刷新仍能短期去重
    this._loadRecentToasts();
    // 注册时间（由场景注册成功时触发 player:registered 事件写入）
    this._registeredAt = null;
    // 极速通关时间窗口（ms）
    this.quickFinishWindow = 10 * 60 * 1000; // 十分钟
    // 成就描述初始可见性默认值（可通过 setDefaultDescriptionVisible 修改）
    this._defaultDescriptionVisible = true;
  }

  _ensureToastContainer() {
    if (document.getElementById('ach-toast-container')) return;
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

  _showToast(meta) {
    // 入队并尝试显示（批量渲染策略）
    // 支持传入 { id, meta } 或仅 meta（兼容旧调用）
    const item = meta && meta.id ? meta : { id: meta && meta._id ? meta._id : null, meta };
    // 去重：若最近已显示过相同 id 的吐司则跳过（不要基于 this.unlocked 判断，否则会阻止刚解锁时的吐司）
    try {
      if (item.id && this._recentToasts.has(String(item.id))) return;
    } catch (e) {}
    this._toastQueue.push(item);
    this._drainToastQueue();
  }

  _drainToastQueue() {
    if (this._toastBusy) return;
    // 批量取出当前队列中的所有待显示项
    if (this._toastQueue.length === 0) return;
    this._toastBusy = true;
    try {
      const c = document.getElementById('ach-toast-container');
      if (!c) {
        this._toastBusy = false;
        return;
      }
      // 取出所有当前排队项
      let batch = this._toastQueue.splice(0, this._toastQueue.length);
      const els = [];
      let maxDuration = 0;
      for (const next of batch) {
        const meta = next && next.meta ? next.meta : next;
        const id = next && next.id ? next.id : meta && meta._id ? meta._id : null;
        // 记录最近已显示的吐司 id（短期去重），统一为字符串
        try {
          if (id) {
            this._recentToasts.add(String(id));
            this._saveRecentToasts();
          }
        } catch (e) {}
        const el = document.createElement('div');
        el.className = 'ach-toast';
        el.style.fontSize = '13px';
        el.style.opacity = '0';
        el.style.transition = 'opacity .28s ease, transform .28s ease';
        el.style.transform = 'translateY(24px)';
        const title = meta && meta.title ? meta.title : '成就解锁';
        const desc = meta && meta.desc ? meta.desc : '';
        const iconHtml = `<div class="ach-icon"><img src='./assets/images/unlock.png' alt='成就已解锁' style='width:100%;height:100%;object-fit:cover' /></div>`;
        el.innerHTML = `
          ${iconHtml}
          <div class="ach-body">
            <strong>${title}</strong>
            <div>${desc}</div>
          </div>
        `;
        c.appendChild(el);
        els.push(el);
        const duration = Math.max(2800, next.duration || 3000);
        if (duration > maxDuration) maxDuration = duration;
      }
      // 同时显示所有批次元素
      requestAnimationFrame(() => {
        for (const el of els) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }
      });
      // 在最长的持续时间后同时隐藏所有元素
      setTimeout(() => {
        for (const el of els) {
          el.style.opacity = '0';
          el.style.transform = 'translateY(24px)';
        }
        setTimeout(() => {
          try {
            for (const el of els) el.remove();
          } catch (e) {}
          // 不执行短期清理：recentToasts 为永久记录（持久化），首次显示后将不再重复显示该成就的吐司
          this._toastBusy = false;
          this._drainToastQueue();
        }, 300);
      }, maxDuration);
    } catch (e) {
      console.warn('ach toast err', e);
      this._toastBusy = false;
      this._drainToastQueue();
    }
  }

  _save() {
    try {
      // 确保以字符串数组形式持久化，避免数字/字符串 id 类型不一致
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked].map((id) => String(id))));
    } catch (e) {
      console.warn('ach save err', e);
    }
  }

  // 持久化 recent toasts（短期去重记录），以便在页面刷新中短期保持去重
  _saveRecentToasts() {
    try {
      const arr = [...this._recentToasts].map((id) => String(id));
      localStorage.setItem(RECENT_TOASTS_KEY, JSON.stringify(arr));
    } catch (e) {
      /* 非阻塞 */
    }
  }

  _loadRecentToasts() {
    try {
      const raw = localStorage.getItem(RECENT_TOASTS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((id) => this._recentToasts.add(String(id)));
    } catch (e) {
      /* 非阻塞 */
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((id) => this.unlocked.add(String(id)));
    } catch (e) {
      console.warn('ach load err', e);
    }
  }

  register(id, meta, predicate) {
    if (!id) throw new Error('achievement id required');
    if (this.achievements.has(id)) {
      console.warn('achievement already registered:', id);
      return;
    }
    // predicate 接口： (events, recordEvent) => boolean | Promise<boolean>
    // events 为当前已记录的事件数组，recordEvent 可用于在 predicate 内部添加合成事件
    const m = Object.assign({ descriptionVisible: this._defaultDescriptionVisible }, meta || {});
    this.achievements.set(id, { meta: m, predicate });
    // 注册后稍微延迟进行一次检查（以便捕获已经满足的条件）
    setTimeout(() => this._checkOne(id), 20);
  }

  async _checkOne(id) {
    // 若已解锁或正在检查则跳过（防止并发导致重复解锁）
    if (this.unlocked.has(id)) return false;
    if (this._checking.has(id)) return false;
    this._checking.add(id);
    const item = this.achievements.get(id);
    if (!item || typeof item.predicate !== 'function') return false;
    try {
      // 将事件副本传入 predicate，并提供 recordEvent 的回调
      const res = item.predicate(this.events.slice(), (ev) => this._recordForPredicate(ev));
      const ok = res instanceof Promise ? await res : res;
      if (ok) {
        // 再次校验避免 race：若在等待期间其他线程已解锁则不重复处理
        if (!this.unlocked.has(id)) {
          this.unlocked.add(id);
          this._save();
        }
        // 使用 audioManager 播放成就音效（遵循全局静音设置）
        try {
          if (audioManager && typeof audioManager.playSound === 'function')
            audioManager.playSound('./assets/audio/Achievement.wav', { volume: 0.35 });
        } catch (e) {}
        // 标记解锁后可见描述
        try {
          item.meta.descriptionVisible = true;
        } catch (e) {}
        // 将 id 附带以便吐司层做去重
        try {
          this._showToast({ id, meta: item.meta });
        } catch (e) {
          this._showToast(item.meta);
        }
        // 全局派发已解锁事件，方便页面或其它模块监听（DEV-friendly）
        try {
          window.dispatchEvent(
            new CustomEvent('achievement:unlocked', { detail: { id: String(id), meta: item.meta } })
          );
        } catch (e) {}
        return true;
      }
    } catch (e) {
      console.warn('achievement check err', e);
    } finally {
      try {
        this._checking.delete(id);
      } catch (e) {}
    }
    return false;
  }

  // 供 predicate 内部调用，用于添加合成/辅助事件到事件队列中
  _recordForPredicate(ev) {
    this.events.push(ev);
    if (this.events.length > 200) this.events.shift();
  }

  // 应用层调用：记录一个事件并触发成就检测
  recordEvent(name, payload) {
    const ev = { name, payload, ts: Date.now() };
    this.events.push(ev);
    if (this.events.length > 200) this.events.shift();
    // 记录注册时间供极速通关判定
    try {
      if (name === 'player:registered') {
        this._registeredAt = ev.ts;
      }
    } catch (e) {}
    // 快速触发所有已注册成就的检查（异步内部处理）
    for (const id of this.achievements.keys()) {
      this._checkOne(id);
    }
    // 若已挂接到事件总线，则也向总线广播一个成就事件
    if (this.bus && typeof this.bus.emit === 'function') {
      try {
        this.bus.emit('achievement:event', ev);
      } catch (e) {}
    }
  }

  // 强制解锁某个成就（可用于测试或管理员触发）
  unlock(id) {
    if (this.unlocked.has(id)) return false;
    if (!this.achievements.has(id)) {
      console.warn('unlock unknown achievement:', id);
      this.unlocked.add(id); // 仍然持久化未知 id，以免重复触发
      this._save();
      return true;
    }
    this.unlocked.add(id);
    this._save();
    const meta = this.achievements.get(id).meta;
    try {
      if (audioManager && typeof audioManager.playSound === 'function')
        audioManager.playSound('./assets/audio/Achievement.wav', { volume: 1.0 });
    } catch (e) {}
    try {
      meta.descriptionVisible = true;
    } catch (e) {}
    try {
      this._showToast({ id, meta });
    } catch (e) {
      this._showToast(meta);
    }
    return true;
  }

  // 清空所有已解锁成就（供开发调试使用）
  clearAll() {
    try {
      this.unlocked.clear();
      this.events = [];
      try {
        this._recentToasts.clear();
        this._saveRecentToasts();
      } catch (e) {}
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      try {
        localStorage.removeItem(RECENT_TOASTS_KEY);
      } catch (e) {}
      // 移除页面上残留的 toast 容器内容
      const c = document.getElementById('ach-toast-container');
      if (c) {
        c.innerHTML = '';
      }
      return true;
    } catch (e) {
      console.warn('ach clearAll err', e);
      return false;
    }
  }

  getUnlocked() {
    return new Set(this.unlocked);
  }

  // 返回注册时间（时间戳 ms），若未注册则返回 null
  getRegisteredAt() {
    return this._registeredAt || null;
  }

  // 返回从注册到现在或到指定时间的已用毫秒，若未注册返回 null
  getElapsedSinceRegistered(whenTs) {
    if (!this._registeredAt) return null;
    const end = typeof whenTs === 'number' ? whenTs : Date.now();
    return Math.max(0, end - this._registeredAt);
  }

  // 将成就管理器挂接到项目的事件总线（若有），方便自动转发全局事件
  attachToEventBus(bus) {
    this.bus = bus;
    if (!bus) return;
    if (typeof bus.on === 'function') {
      // 示例：监听全局事件并转发到 recordEvent
      try {
        bus.on('app:event', (ev) => this.recordEvent(ev.name, ev.payload));
      } catch (e) {
        /* 尽力而为，不阻塞主流程 */
      }
    }
  }

  // 返回所有已注册成就的列表，包含 id, meta, unlocked(boolean)
  listRegistered() {
    const out = [];
    for (const [id, item] of this.achievements.entries()) {
      out.push({
        id: String(id),
        meta: Object.assign({}, item.meta),
        unlocked: this.unlocked.has(id),
      });
    }
    return out;
  }

  // 设置全局默认的 descriptionVisible 值（仅影响后续注册的成就）
  setDefaultDescriptionVisible(flag) {
    this._defaultDescriptionVisible = !!flag;
  }

  // 手动设置某个已注册成就的 descriptionVisible 值
  setDescriptionVisible(id, flag) {
    try {
      const item = this.achievements.get(id);
      if (!item) return false;
      item.meta.descriptionVisible = !!flag;
      return true;
    } catch (e) {
      return false;
    }
  }
}

export const achievements = new Achievements();
export default achievements;

// 成就 0-0：完成注册（注册时触发）
achievements.register(
  '0-0',
  {
    title: '完成注册',
    desc: '注册完成，旅程开始！',
    descriptionVisible: true,
  },
  (events) => {
    try {
      return events.some((ev) => ev && ev.name === 'player:registered');
    } catch (e) {
      return false;
    }
  }
);

// 成就 0-1 —— 在注册页面输入生日密码
achievements.register(
  '0-1',
  {
    title: '生日密码',
    desc: '这年头谁还用生日当密码呀',
    descriptionVisible: false,
  },
  (events) => {
    return events.some(
      (ev) =>
        ev &&
        ev.name === 'scene0:entered_birthday' &&
        ev.payload &&
        (ev.payload.pass === '20051210' || ev.payload.pass === '20051005')
    );
  }
);

// 成就 0-2：在注册页面多次点击“我忘了”并触发哭脸
achievements.register(
  '0-2',
  {
    title: '记性真差',
    desc: '你是不是故意的？',
    descriptionVisible: false,
  },
  (events) => {
    return events.some((ev) => ev && ev.name === 'scene0:forgot_cry');
  }
);

// 成就 0-3：密码错误达到 6 次（连续错误导致退出）
achievements.register(
  '0-3',
  {
    title: '执着的尝试',
    desc: '好奇心不仅会害死猫，还会气死我',
    descriptionVisible: false,
  },
  (events) => {
    return events.some((ev) => ev && ev.name === 'scene0:failed_six');
  }
);

// 成就 1-0：完成第一幕（进入下一段记忆或胜利分支）
achievements.register(
  '1-0',
  {
    title: '通关第一幕',
    desc: '完成第一幕，进入下一段记忆。',
    descriptionVisible: true,
  },
  (events) => {
    try {
      return events.some((ev) => ev && ev.name === 'scene1:completed');
    } catch (e) {
      return false;
    }
  }
);

// 成就 2-0：通关第二幕（完成考试并进入下一阶段）
achievements.register(
  '2-0',
  {
    title: '通关第二幕',
    desc: '完成第二幕的考试，进入下一段记忆。',
    descriptionVisible: true,
  },
  (events) => {
    try {
      // 支持两种上报方式：明确的 scene2:completed 或者已有的 scene2:exam_summary（且包含 totalQuestions）
      if (events.some((ev) => ev && ev.name === 'scene2:completed')) return true;
      const e = events.find((ev) => ev && ev.name === 'scene2:exam_summary');
      if (!e || !e.payload) return false;
      return typeof e.payload.totalQuestions === 'number' && e.payload.totalQuestions > 0;
    } catch (e) {
      return false;
    }
  }
);

// 成就 2-1：第二幕超级学霸（未使用提示、未跳过、未出现错误宠溺）
achievements.register(
  '2-1',
  {
    title: '超级学霸',
    desc: '考试一次过，你就是学霸！',
    descriptionVisible: true,
  },
  (events) => {
    try {
      const e = events.find((ev) => ev && ev.name === 'scene2:exam_summary');
      if (!e || !e.payload) return false;
      const {
        hintsUsed = 0,
        skippedQuestions = 0,
        pamperedWrongCount = 0,
        totalQuestions = 0,
      } = e.payload;
      return (
        totalQuestions > 0 && hintsUsed === 0 && skippedQuestions === 0 && pamperedWrongCount === 0
      );
    } catch (e) {
      return false;
    }
  }
);

// 成就 2-2：本次考试全部由宠溺跳过通过
achievements.register(
  '2-2',
  {
    title: '我帮你做啦',
    desc: '可爱溜溜，不怕困难，因为有我~',
    descriptionVisible: false,
  },
  (events) => {
    try {
      const e = events.find((ev) => ev && ev.name === 'scene2:exam_summary');
      if (!e || !e.payload) return false;
      const { skippedQuestions = 0, totalQuestions = 0 } = e.payload;
      return totalQuestions > 0 && skippedQuestions === totalQuestions;
    } catch (e) {
      return false;
    }
  }
);

// 成就 2-3：本次考试全部靠第三次提示（自动判定）完成
achievements.register(
  '2-3',
  {
    title: '被提示包圆',
    desc: '人与动物最大的区别就是会使用工具',
    descriptionVisible: false,
  },
  (events) => {
    try {
      const e = events.find((ev) => ev && ev.name === 'scene2:exam_summary');
      if (!e || !e.payload) return false;
      const { autoHintCount = 0, totalQuestions = 0 } = e.payload;
      return totalQuestions > 0 && autoHintCount === totalQuestions;
    } catch (e) {
      return false;
    }
  }
);

// 成就 2-4：本次考试全部为宠溺错误（全部答错走宠溺逻辑）
achievements.register(
  '2-4',
  {
    title: '错误也可爱',
    desc: '精准避开正确答案，莫非你是天选之子？',
    descriptionVisible: false,
  },
  (events) => {
    try {
      const e = events.find((ev) => ev && ev.name === 'scene2:exam_summary');
      if (!e || !e.payload) return false;
      const { pamperedWrongCount = 0, totalQuestions = 0 } = e.payload;
      return totalQuestions > 0 && pamperedWrongCount === totalQuestions;
    } catch (e) {
      return false;
    }
  }
);

// 成就 3-0：完成第三幕——完成第 3 幕的最后一张数织图
achievements.register(
  '3-0',
  {
    title: '通关第三幕',
    desc: '完成第三幕的拼图，进入下一段记忆。',
    descriptionVisible: true,
  },
  (events) => {
    return events.some((ev) => ev && ev.name === 'scene3:final_complete');
  }
);

// 成就 3-1：心灵手巧——完成第 3 幕的最后一张数织图且未使用提示
achievements.register(
  '3-1',
  {
    title: '心灵手巧',
    desc: '小小数织，拿捏！',
    descriptionVisible: true,
  },
  (events) => {
    try {
      const e = events.find((ev) => ev && ev.name === 'scene3:final_complete');
      if (!e || !e.payload) return false;
      return e.payload.hintUse === false;
    } catch (e) {
      return false;
    }
  }
);

// 成就 3-2：叛逆心理 —— 任意一关填色与正确答案完全相反（完全反转）
achievements.register(
  '3-2',
  {
    title: '叛逆心理',
    desc: '你故意把所有格子都涂成相反的样子？',
    descriptionVisible: false,
  },
  (events) => {
    try {
      // 宽松匹配：支持不同事件名与不同 payload 字段命名
      // 1) 关注即时反转事件：scene3:puzzle_inverted
      if (events.some((ev) => ev && ev.name === 'scene3:puzzle_inverted')) return true;
      // 2) 支持完成时上报的字段（scene3:puzzle_complete or scene3:final_complete）
      const candidate = events.find(
        (ev) => ev && (ev.name === 'scene3:puzzle_complete' || ev.name === 'scene3:final_complete')
      );
      if (!candidate || !candidate.payload) return false;
      const p = candidate.payload;
      // 常见字段：completelyInverted, inverted, filledOpposite, inversionRatio
      if (p.completelyInverted === true) return true;
      if (p.inverted === true) return true;
      if (p.filledOpposite === true) return true;
      if (typeof p.inversionRatio === 'number' && p.inversionRatio === 1) return true;
      // 有时 payload 可能携带原始统计字段
      if (typeof p.inversion_ratio === 'number' && p.inversion_ratio === 1) return true;
      return false;
    } catch (e) {
      return false;
    }
  }
);

// 成就 3-3：快！准！狠！—— 第三幕任意一张数织图：未发生错误点击、未使用重置、未使用擦除（右键）
// 条件：监听 scene3:puzzle_complete / scene3:final_complete 中 wrongClick/useReset/useErase 均为 0
achievements.register(
  '3-3',
  {
    title: '快！准！狠！',
    desc: '你是不是看过题啊？太厉害了吧！',
    descriptionVisible: false,
  },
  (events) => {
    try {
      const ev = events.find(
        (e) =>
          e &&
          (e.name === 'scene3:puzzle_complete' || e.name === 'scene3:final_complete') &&
          e.payload &&
          e.payload.wrongClick === 0 &&
          e.payload.useReset === 0 &&
          e.payload.useErase === 0
      );
      if (!ev) return false;
      const p = ev.payload;
      return !p.wrongClick && !p.useReset && !p.useErase;
    } catch (e) {
      return false;
    }
  }
);

// 成就 8-0：进入第八幕（终章）——完成游戏
achievements.register(
  '8-0',
  {
    title: '完成旅程',
    desc: '到达终章，完成整个旅程',
    descriptionVisible: true,
  },
  (events) => {
    return events.some((ev) => ev && ev.name === 'scene8:entered');
  }
);

// 成就 8-1：在注册后 N 毫秒内通关（默认 10 分钟，可通过 achievements.quickFinishWindow 调整）
achievements.register(
  '8-1',
  {
    title: '极速通关',
    desc: '在注册后十分钟内完成旅程',
    descriptionVisible: true,
  },
  (events) => {
    // 若没有记录注册时间，则无法判定
    try {
      const start = achievements._registeredAt;
      if (!start) return false;
      // 寻找进入终章事件时间戳
      const e = events.find((ev) => ev && ev.name === 'scene8:entered');
      if (!e) return false;
      return e.ts - start <= achievements.quickFinishWindow;
    } catch (e) {
      return false;
    }
  }
);
