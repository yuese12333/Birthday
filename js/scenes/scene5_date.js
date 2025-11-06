import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { achievements } from '../core/achievements.js';

export class Scene5Date extends BaseScene {
  async init() {
    await super.init();
    // 从 data/scene5_levels.json 读取关卡配置（默认使用第一关），不做回退处理
    const resp = await fetch('data/scene5_levels.json');
    const d = await resp.json();
    const levels = Array.isArray(d && d.levels) ? d.levels : [];
    // 持久化到实例，供 enter 使用
    this.levels = levels;
    // 支持通过 URL 参数 scene5_level 指定要使用的关卡（可以是 id 或 以 1 为基准的序号）
    const params = new URLSearchParams(window.location.search);
    const sel = params.get('scene5_level');
    let chosen = levels[0];
    if (sel) {
      const byId = levels.find((x) => String(x.id) === String(sel));
      if (byId) chosen = byId;
      else {
        const asNum = Number(sel);
        if (!Number.isNaN(asNum) && levels[asNum - 1]) chosen = levels[asNum - 1];
      }
    }
    // 支持矩形网格 rows x cols（JSON 中使用 rows, cols）
    this.rows = chosen && typeof chosen.rows !== 'undefined' ? Number(chosen.rows) : this.rows || 8;
    this.cols = chosen && typeof chosen.cols !== 'undefined' ? Number(chosen.cols) : this.cols || 8;
    // 记录当前关索引
    const foundIdx = levels.findIndex(
      (lv) => lv === chosen || (lv && chosen && String(lv.id) === String(chosen.id))
    );
    this.currentLevelIndex = foundIdx >= 0 ? foundIdx : 0;
    // 支持 mineCounts 而不是固定坐标的 mines（编辑器只保存每档雷数）
    this.mines = [];
    if (chosen && typeof chosen.mineCounts === 'object' && chosen.mineCounts !== null) {
      this.mineCounts = {
        easy: Number(chosen.mineCounts.easy) || 8,
        medium: Number(chosen.mineCounts.medium) || 12,
        hard: Number(chosen.mineCounts.hard) || 18,
      };
    } else {
      this.mineCounts = { easy: 8, medium: 12, hard: 18 };
    }
    // 读取 disabled（禁用格）配置
    if (chosen && Array.isArray(chosen.disabled))
      this.disabled = chosen.disabled.map((d) => [Number(d[0]), Number(d[1])]);
    else this.disabled = [];
    this.flags = new Set();
    this.opened = new Set();
    this.gameOver = false;
    // 感染计数：每局最多被传染的格子数
    this._infectedCount = 0;
    // 每关点击计数（用于检测首发踩雷）
    this._levelClicks = 0;
  }

  async enter() {
    const el = document.createElement('div');
    el.className = 'scene scene-date';
    el.innerHTML = `
      <h1>场景5：心跳扫雷</h1>
      <div style="display:flex; gap:.6rem; align-items:center; margin:.3rem 0 .6rem;">
        <div class='status'>剩余雷数: <span class='remain'></span></div>
        <div class='level-progress' style='margin-left:.6rem;'>关卡 <span class='level-cur'></span>/<span class='level-total'></span></div>
        <button class='bgm-btn date-bgm' title='音乐' style='margin-left:auto;'>♪</button>
      </div>
      <div class='ms-controls' style='margin-bottom:.6rem; display:flex; gap:.6rem; align-items:center;'>
        <div class='controls-left' style='display:flex; gap:.6rem; align-items:center;'>
          <button class='restart' data-debounce='600'>重开本关</button>
        </div>
        <div class='msg' style='margin-left:auto; color:#333;'></div>
      </div>
      <div class='ms-wrapper'>
        <div class='ms-grid'></div>
      </div>
    `;

    this.applyNoSelect(el);
    const gridEl = el.querySelector('.ms-grid');
    const remainEl = el.querySelector('.remain');
    const levelCurEl = el.querySelector('.level-cur');
    const levelTotalEl = el.querySelector('.level-total');
    const msgEl = el.querySelector('.msg');
    const restartBtn = el.querySelector('.restart');
    const bgmBtn = el.querySelector('.date-bgm');

    // 初始化关卡进度显示
    if (levelTotalEl)
      levelTotalEl.textContent =
        this.levels && this.levels.length ? this.levels.length : levels.length;
    if (levelCurEl)
      levelCurEl.textContent =
        typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex + 1 : 1;

    // BGM（保留原 key '5' 行为一致性）
    const bgmAudio = audioManager.playSceneBGM('5', { loop: true, volume: 0.55, fadeIn: 700 });
    bgmBtn.addEventListener('click', () => {
      if (bgmAudio && bgmAudio.paused) {
        bgmAudio.play().catch(() => {});
        audioManager.globalMuted = false;
        bgmAudio.muted = false;
        bgmBtn.classList.remove('muted');
        return;
      }
      const muted = audioManager.toggleMute();
      bgmBtn.classList.toggle('muted', muted);
    });

    // 网格的最小样式
    if (!document.getElementById('ms-style')) {
      const s = document.createElement('style');
      s.id = 'ms-style';
      s.textContent = `
  .ms-grid { display:grid; grid-template-columns: repeat(${this.cols}, 40px); gap:6px; }
      .ms-cell { width:40px; height:40px; background:#f2f2f2; border-radius:6px; display:flex;align-items:center;justify-content:center;cursor:pointer; user-select:none; font-weight:700; }
      .ms-cell.opened { background:#fff; cursor:default; box-shadow:inset 0 0 0 1px #e6e6e6; }
      .ms-cell.flagged { background:#fff3f5; color:#d33; }
      .ms-cell.mine { background:#ffdddd; color:#900; }
      .ms-cell.number-1 { color:#0b66ff; }
      .ms-cell.number-2 { color:#0b9e3f; }
      .ms-cell.number-3 { color:#ff6b6b; }
      .ms-cell.number-4 { color:#5829b5; }
  /* disabled 单元不显示内容且不可交互，但保留格位占位以不打乱坐标 */
  .ms-cell.disabled { background:transparent; color:transparent; visibility:hidden; pointer-events:none; }
  .ms-controls button.selected { outline:2px solid #0b66ff; box-shadow:0 0 0 2px rgba(11,102,255,0.08); }
  /* 数学化渲染样式 */
  .ms-cell sup { font-size:70%; vertical-align:super; margin-left:2px; }
  .ms-cell .sqrt { display:inline-flex; align-items:center; gap:3px; font-family: inherit; }
  .ms-cell .sqrt .rad { display:inline-block; transform:translateY(-2px); }
  .ms-cell .fraction { font-size:90%; display:inline-flex; align-items:center; gap:4px; }
  .ms-cell .fraction { font-size:90%; display:inline-flex; flex-direction:column; align-items:center; gap:2px; line-height:1; }
  .ms-cell .fraction .num, .ms-cell .fraction .den { display:block; }
  .ms-cell .fraction .bar { width:100%; height:1px; background:currentColor; display:block; }
      `;
      document.head.appendChild(s);
    }

    // 辅助函数
    const idx = (r, c) => `${r},${c}`;
    const parseIdx = (key) => key.split(',').map((n) => parseInt(n, 10));
    let disabledSet = new Set((this.disabled || []).map(([r, c]) => idx(r, c)));
    const mineKeys = (this.mines || [])
      .map(([r, c]) => idx(r, c))
      .filter((k) => !disabledSet.has(k));
    // 注意：如果使用随机布雷，则初始 this.mines 为空；会在 startGame 时生成
    let mineSet = new Set(mineKeys);
    let totalMines = mineSet.size;

    const neighbors = (r, c) => {
      const res = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr,
            nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            const k = idx(nr, nc);
            if (disabledSet.has(k)) continue;
            res.push([nr, nc]);
          }
        }
      return res;
    };

    const countAdjacentMines = (r, c) =>
      neighbors(r, c).reduce((a, [nr, nc]) => a + (mineSet.has(idx(nr, nc)) ? 1 : 0), 0);

    // 将数字格式化为多种呈现形式（每个数字除了 1 外有多个变体，随机选择用于显示）
    const numberVariants = {
      2: ['2', '5-3', '4/2', '3-1'],
      3: ['3', '√9', '6/2', '1+2'],
      4: ['4', '2^2', '√16', '8/2', '5-1'],
      5: ['5', '10/2', '2+3', '7-2', '∛125'],
      6: ['6', '3*2', '12/2', '√36', '7-1'],
      7: ['7', '10-3', '14/2', '3+4'],
      8: ['8', '2^3', '16/2', '4*2', '9-1'],
    };

    const formatNumber = (n) => {
      if (typeof n !== 'number' || n <= 0) return '';
      if (n === 1) return '1';
      const opts = numberVariants[n] || [String(n)];
      return opts[Math.floor(Math.random() * opts.length)];
    };

    const escapeHtml = (str) =>
      String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // 将变体文本渲染为简单的数学化 HTML：支持 ^ 为上标（如 2^2），√ 前缀渲染为根号，a/b 渲染为分数
    const renderVariant = (variant) => {
      if (!variant) return '';
      const v = String(variant).trim();
      // 上标形式 2^2
      if (/\^/.test(v)) {
        const parts = v.split('^');
        return `${escapeHtml(parts[0])}<sup>${escapeHtml(parts[1])}</sup>`;
      }
      // 带根次的根号支持：Unicode 形式（例如 ∛125 表示 125 的三次根）
      if (v.startsWith('∛')) {
        const inside = v.slice(1).replace(/^\(|\)$/g, '');
        return `<span class='sqrt nth'><span class='rad'><span class='index'>3</span>√</span><span>${escapeHtml(
          inside
        )}</span></span>`;
      }
      // 形式如 3√125（根次在前），例如 '3√125'
      const nthMatch = v.match(/^(\d+)√(.*)$/);
      if (nthMatch) {
        const n = nthMatch[1];
        const inside = nthMatch[2].replace(/^\(|\)$/g, '');
        return `<span class='sqrt nth'><span class='rad'><span class='index'>${escapeHtml(
          n
        )}</span>√</span><span>${escapeHtml(inside)}</span></span>`;
      }
      // 根号形式 √9 或 √(9)
      if (v.startsWith('√')) {
        const inside = v.slice(1).replace(/^\(|\)$/g, '');
        return `<span class='sqrt'><span class='rad'>√</span><span>${escapeHtml(
          inside
        )}</span></span>`;
      }
      // 分数形式 a/b
      if (v.includes('/')) {
        const [num, den] = v.split('/');
        return `<span class='fraction'><span class='num'>${escapeHtml(
          num
        )}</span><span class='bar'></span><span class='den'>${escapeHtml(den)}</span></span>`;
      }
      // 默认直接文本
      return escapeHtml(v);
    };

    // 渲染网格（disabled 单元以 × 显示且不绑定事件）
    function buildGrid() {
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 40px)`;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'ms-cell';
          cell.dataset.r = r;
          cell.dataset.c = c;
          const key = idx(r, c);
          if (disabledSet.has(key)) {
            cell.classList.add('disabled');
          } else {
            cell.addEventListener('click', (e) => {
              if (!this.gameOver) onLeftClick(r, c, cell);
            });
            cell.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              if (!this.gameOver) onRightClick(r, c, cell);
            });
          }
          gridEl.appendChild(cell);
        }
      }
      remainEl.textContent = totalMines - this.flags.size;
    }

    // 按难度随机布雷（排除 disabled）
    const randomPlaceMines = (count) => {
      const available = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const k = idx(r, c);
          if (!disabledSet.has(k)) available.push(k);
        }
      // 如果请求的雷数超过可用格数，按最大可用数
      const n = Math.min(count, available.length);
      // 洗牌并取前 n
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      return new Set(available.slice(0, n));
    };

    // 启动或重置游戏（根据当前 difficulty 随机布雷）
    this.currentDifficulty = null; // 只有用户显式选择难度后才开始
    this.gameStarted = false;
    const startGame = (difficulty) => {
      // 重新计算 disabledSet（可能是在切换关卡后）
      disabledSet = new Set((this.disabled || []).map(([r, c]) => idx(r, c)));
      // 重置本局感染计数
      this._infectedCount = 0;
      this.flags.clear();
      this.opened.clear();
      this.gameOver = false;
      msgEl.textContent = '';
      const count = Number(this.mineCounts && this.mineCounts[difficulty]) || 0;
      mineSet = randomPlaceMines(count);
      totalMines = mineSet.size;
      // 更新全局 this.mines 为随机布雷的数组（仅用于调试或保存需要）
      this.mines = Array.from(mineSet).map((k) => parseIdx(k));
      this.gameStarted = true;
      // 重置本关点击计数
      this._levelClicks = 0;
      // 确保上一关留下的下一步按钮区域被清除
      try {
        const controls = el.querySelector('.ms-controls');
        const existingNext = controls && controls.querySelector('.next-area');
        if (existingNext) existingNext.innerHTML = '';
      } catch (e) {}
      buildGrid.call(this);
      remainEl.textContent = totalMines - this.flags.size;
      // 更新关卡进度显示（1-based）
      if (levelCurEl)
        levelCurEl.textContent =
          typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex + 1 : 1;
      if (levelTotalEl)
        levelTotalEl.textContent =
          this.levels && this.levels.length ? this.levels.length : levels.length;
    };

    // 小型 toast 系统：在屏幕左下角显示短暂提示
    if (!document.getElementById('ms-toast-style')) {
      const ts = document.createElement('style');
      ts.id = 'ms-toast-style';
      ts.textContent = `
      .ms-toast-container{position:fixed;left:12px;bottom:12px;z-index:10000;display:flex;flex-direction:column;gap:8px;}
      .ms-toast{background:rgba(0,0,0,.78);color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transform:translateY(6px);transition:opacity .18s ease,transform .18s ease;font-size:13px;}
      .ms-toast.show{opacity:1;transform:translateY(0);}
      `;
      document.head.appendChild(ts);
    }
    const getToastContainer = () => {
      let c = document.querySelector('.ms-toast-container');
      if (!c) {
        c = document.createElement('div');
        c.className = 'ms-toast-container';
        document.body.appendChild(c);
      }
      return c;
    };
    const showToast = (text, ms = 3000) => {
      try {
        const c = getToastContainer();
        const t = document.createElement('div');
        t.className = 'ms-toast';
        t.textContent = text;
        c.appendChild(t);
        // 强制回流以便 transition 生效
        void t.offsetWidth;
        t.classList.add('show');
        setTimeout(() => {
          t.classList.remove('show');
          setTimeout(() => {
            try {
              t.remove();
            } catch (e) {}
            try {
              if (c.children.length === 0) c.remove();
            } catch (e) {}
          }, 220);
        }, ms);
      } catch (e) {
        console.warn('toast err', e);
      }
    };

    // 传染判定：在点击一个格子时，有一定几率（10%）将其 3x3 区域内的一个合法格子变成雷
    // 规则：每次点击最多传染一个格子；每局最多传染 3 个格子；传染不作用于 disabled / 已是雷 / 已打开 / 已标记 的格子
    const tryInfect = (clickR, clickC) => {
      try {
        if (this._infectedCount >= 3) return false;
        if (Math.random() >= 0.1) return false; // 90% 无效
        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = clickR + dr;
            const nc = clickC + dc;
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            // 跳过中心格，确保不会把当前点击的格子变为雷
            if (dr === 0 && dc === 0) continue;
            const k = idx(nr, nc);
            if (disabledSet.has(k)) continue;
            if (mineSet.has(k)) continue;
            if (this.opened.has(k)) continue;
            if (this.flags.has(k)) continue;
            candidates.push([nr, nc]);
          }
        }
        if (candidates.length === 0) return false;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const [ir, ic] = pick;
        const ik = idx(ir, ic);
        // 将该格加入地雷集合
        mineSet.add(ik);
        this._infectedCount += 1;
        // 更新总雷数与辅助数组
        totalMines = mineSet.size;
        this.mines = Array.from(mineSet).map((k) => parseIdx(k));
        // 更新显示
        if (remainEl) remainEl.textContent = totalMines - this.flags.size;
        // 可选：短暂提示玩家（改为左下角 toast）并上报感染事件
        try {
          showToast('附近出现了新的雷……小心！', 1000);
        } catch (e) {
          if (msgEl) msgEl.textContent = '附近出现了新的雷……小心！';
        }
        // 成功传染：（注意）连续计数逻辑由 onLeftClick 根据 tryInfect 返回值维护
        // 更新新出现的雷周围已打开格子的数字（局部刷新）
        try {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = ir + dr;
              const nc = ic + dc;
              if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
              const nk = idx(nr, nc);
              if (disabledSet.has(nk)) continue;
              const ncell = gridEl.querySelector(`.ms-cell[data-r='${nr}'][data-c='${nc}']`);
              if (!ncell) continue;
              // 仅更新已打开且不是地雷的格子的数字显示
              if (ncell.classList.contains('opened') && !ncell.classList.contains('mine')) {
                const adj = countAdjacentMines(nr, nc);
                if (adj > 0) {
                  ncell.innerHTML = renderVariant(formatNumber(adj));
                  ncell.classList.remove('number-1', 'number-2', 'number-3', 'number-4');
                  ncell.classList.add('number-' + Math.min(adj, 4));
                } else {
                  ncell.textContent = '';
                  ncell.classList.remove('number-1', 'number-2', 'number-3', 'number-4');
                }
              }
            }
          }
        } catch (e) {
          console.warn('refresh nums err', e);
        }
        return true;
      } catch (e) {
        console.warn('infect err', e);
        return false;
      }
    };

    // 递归打开单元格（空白格自动展开）
    const openCell = (row, col) => {
      const key = idx(row, col);
      // 终止条件：已打开、已标记或被禁用
      if (this.opened.has(key) || this.flags.has(key) || disabledSet.has(key)) return;
      // 标记为已打开并更新视觉
      this.opened.add(key);
      const cell = gridEl.querySelector(`.ms-cell[data-r='${row}'][data-c='${col}']`);
      if (!cell) return;
      cell.classList.add('opened');
      cell.classList.remove('flagged');
      const adj = countAdjacentMines(row, col);
      if (adj > 0) {
        cell.innerHTML = renderVariant(formatNumber(adj));
        cell.classList.add('number-' + Math.min(adj, 4));
        return;
      }
      // 若为 0，则递归打开周围8个格子（neighbors 已排除 disabled）
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const r = row + i;
          const c = col + j;
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
            const nkey = idx(r, c);
            // 如果邻居被标记（flagged）或被禁用，则不展开
            if (this.flags.has(nkey) || disabledSet.has(nkey)) continue;
            openCell(r, c);
          }
        }
      }
    };

    const revealAllMines = (lost) => {
      mineSet.forEach((k) => {
        const [r, c] = parseIdx(k);
        const cell = gridEl.querySelector(`.ms-cell[data-r='${r}'][data-c='${c}']`);
        if (!cell) return;
        cell.classList.add('opened', 'mine');
        if (!lost) cell.textContent = '💣';
        else cell.textContent = '💥';
      });
    };

    const checkWin = () => {
      // 胜利条件：已打开的格子数等于（总可用格子 - 雷数）
      const totalCells = this.rows * this.cols - disabledSet.size;
      if (totalMines <= 0) return false; // 如果未布雷则不判定为胜利
      if (this.opened.size === totalCells - totalMines) return true;
      return false;
    };

    const onLeftClick = (r, c, cell) => {
      const key = idx(r, c);
      // 仅在有效点击（未打开、未标记、未禁用）时计数
      if (this.opened.has(key) || this.flags.has(key) || disabledSet.has(key)) return;
      // 传染判定（不再维护连续传染计数或上报 infected_double 成就事件）
      const infected = tryInfect(r, c);
      try {
        this._levelClicks = (this._levelClicks || 0) + 1;
      } catch (e) {
        this._levelClicks = 1;
      }
      if (mineSet.has(key)) {
        // 触雷
        cell.classList.add('opened', 'mine');
        cell.textContent = '💥';
        this.gameOver = true;
        revealAllMines(true);
        msgEl.textContent = '踩到雷了……（失败）';
        // 如果这是本关的第一次点击则上报“一发入魂”事件
        try {
          const currentLevelIndex =
            typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
          // 记录踩雷事件（用于拆弹专家成就），payload 包含是否为本关第一次点击
          achievements.recordEvent('scene5:stepped_mine', {
            level: currentLevelIndex,
            difficulty: this.currentDifficulty,
            first: this._levelClicks === 1,
          });
          if (this._levelClicks === 1) {
            achievements.recordEvent('scene5:first_click_mine', {
              level: currentLevelIndex,
              difficulty: this.currentDifficulty,
            });
          }
        } catch (e) {
          console.warn('ach record first_click err', e);
        }
        // 触雷后确保难度按钮与重开按钮可用（有时界面可能处于 disabled 状态）
        try {
          const diffBtns =
            controlsEl && Array.from(controlsEl.querySelectorAll('button[data-diff]'));
          if (diffBtns) {
            diffBtns.forEach((b) => {
              b.disabled = false;
              b.removeAttribute('aria-disabled');
              b.classList.remove('disabled');
            });
          }
          if (restartBtn) {
            restartBtn.disabled = false;
            restartBtn.removeAttribute('aria-disabled');
            restartBtn.classList.remove('disabled');
          }
        } catch (e) {}
        return;
      }
      // open
      const adj = countAdjacentMines(r, c);
      if (adj > 0) {
        // 直接打开显示数字
        this.opened.add(key);
        cell.classList.add('opened');
        cell.innerHTML = renderVariant(formatNumber(adj));
        cell.classList.add('number-' + Math.min(adj, 4));
      } else {
        // 对于 0 邻居，使用递归统一处理（openCell 会标记并展开）
        openCell(r, c);
      }
      if (checkWin()) {
        this.gameOver = true;
        revealAllMines(false);
        msgEl.textContent = '恭喜，扫雷成功！';
        // 对每一关完成都上报事件，payload 中包含 final 字段（仅最后一关为 true）
        try {
          const currentLevelIndex =
            typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
          const lvList = this.levels && this.levels.length ? this.levels : levels;
          const isLast = currentLevelIndex >= lvList.length - 1;
          achievements.recordEvent('scene5:completed', {
            level: currentLevelIndex,
            difficulty: this.currentDifficulty,
            final: Boolean(isLast),
          });
        } catch (e) {
          console.warn('ach record err', e);
        }
        // 成功后显示下一关或进入下一幕按钮
        const controls = el.querySelector('.ms-controls');
        // 清除已有的下一步按钮区域（避免重复）
        let nextArea = controls.querySelector('.next-area');
        if (!nextArea) {
          nextArea = document.createElement('div');
          nextArea.className = 'next-area';
          nextArea.style.marginLeft = '0.6rem';
          controls.appendChild(nextArea);
        }
        nextArea.innerHTML = '';
        // 完成关卡后禁用难度选择和重开本关按钮，直到进入下一关时再启用
        try {
          // 更可靠地从 controlsEl 查询难度按钮（避免闭包 / 变量声明时序问题）
          const diffBtns =
            controlsEl && Array.from(controlsEl.querySelectorAll('button[data-diff]'));
          if (diffBtns) {
            diffBtns.forEach((b) => {
              b.disabled = true;
              b.setAttribute('aria-disabled', 'true');
              b.classList.add('disabled');
            });
          }
          if (restartBtn) {
            restartBtn.disabled = true;
            restartBtn.setAttribute('aria-disabled', 'true');
            restartBtn.classList.add('disabled');
          }
        } catch (e) {}
        const currentLevelIndex =
          typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
        const lvList = this.levels && this.levels.length ? this.levels : levels;
        const isLast = currentLevelIndex >= lvList.length - 1;
        if (!isLast) {
          const nxt = document.createElement('button');
          nxt.textContent = '下一关';
          nxt.addEventListener('click', () => {
            const nextIdx = currentLevelIndex + 1;
            const nextLv = lvList[nextIdx];
            if (nextLv) {
              // 切换到下一关的配置
              this.currentLevelIndex = nextIdx;
              // 支持 rows/cols
              this.rows = Number(nextLv.rows) || this.rows;
              this.cols = Number(nextLv.cols) || this.cols;
              this.mineCounts = nextLv.mineCounts || this.mineCounts;
              this.disabled = Array.isArray(nextLv.disabled)
                ? nextLv.disabled.map((d) => [Number(d[0]), Number(d[1])])
                : [];
              // 更新关卡进度显示
              if (levelCurEl) levelCurEl.textContent = this.currentLevelIndex + 1;
              if (levelTotalEl)
                levelTotalEl.textContent =
                  this.levels && this.levels.length ? this.levels.length : levels.length;
              // 更新样式列数（替换样式节点内容以使用新的 gridSize）
              const sEl = document.getElementById('ms-style');
              if (sEl) {
                sEl.textContent = sEl.textContent.replace(
                  /repeat\(\d+, 40px\)/,
                  `repeat(${this.cols}, 40px)`
                );
              }
              // 隐藏/清除下一步区域，避免切换后仍显示
              try {
                const controls = el.querySelector('.ms-controls');
                const na = controls && controls.querySelector('.next-area');
                if (na) na.innerHTML = '';
              } catch (e) {}
              // 在进入下一关前重新启用难度选择和重开按钮（可能在通关时被禁用）
              try {
                const diffBtns =
                  controlsEl && Array.from(controlsEl.querySelectorAll('button[data-diff]'));
                if (diffBtns) {
                  diffBtns.forEach((b) => {
                    b.disabled = false;
                    b.removeAttribute('aria-disabled');
                    b.classList.remove('disabled');
                  });
                }
                if (restartBtn) {
                  restartBtn.disabled = false;
                  restartBtn.removeAttribute('aria-disabled');
                  restartBtn.classList.remove('disabled');
                }
              } catch (e) {}
              startGame(this.currentDifficulty);
            }
          });
          nextArea.appendChild(nxt);
        } else {
          const nxt = document.createElement('button');
          nxt.textContent = '进入下一幕';
          nxt.addEventListener('click', () => {
            if (this.ctx && typeof this.ctx.go === 'function') {
              // 使用项目常见的转场调用，跳转到 scarf 场景（如果需要改名再调整）
              this.ctx.go('scarf');
            }
          });
          nextArea.appendChild(nxt);
        }
      }
    };

    const onRightClick = (r, c, cell) => {
      const key = idx(r, c);
      if (disabledSet.has(key) || this.opened.has(key)) return;
      if (this.flags.has(key)) {
        this.flags.delete(key);
        cell.classList.remove('flagged');
        cell.textContent = '';
      } else {
        this.flags.add(key);
        cell.classList.add('flagged');
        cell.textContent = '⚑';
      }
      remainEl.textContent = totalMines - this.flags.size;
    };

    const resetGame = () => {
      if (!this.currentDifficulty) {
        msgEl.textContent = '请先选择难度再开始游戏。';
        return;
      }
      startGame(this.currentDifficulty);
    };

    // 在界面中添加难度选择按钮
    const controlsEl = el.querySelector('.ms-controls');
    const diffContainer = document.createElement('div');
    diffContainer.style.display = 'flex';
    diffContainer.style.gap = '6px';
    diffContainer.style.marginRight = '1rem';
    ['easy', 'medium', 'hard'].forEach((d) => {
      const b = document.createElement('button');
      b.textContent = { easy: '简单', medium: '普通', hard: '困难' }[d];
      b.dataset.diff = d;
      b.addEventListener('click', () => {
        // 设为当前难度并高亮
        this.currentDifficulty = d;
        // 高亮样式
        Array.from(diffContainer.children).forEach((btn) =>
          btn.classList.toggle('selected', btn.dataset.diff === d)
        );
        // 开始游戏
        startGame(d);
      });
      diffContainer.appendChild(b);
    });
    controlsEl.insertBefore(diffContainer, controlsEl.firstChild);

    // 默认启动：选择简单难度并开始第一关
    try {
      this.currentDifficulty = 'easy';
      Array.from(diffContainer.children).forEach((btn) =>
        btn.classList.toggle('selected', btn.dataset.diff === 'easy')
      );
      // 直接开始游戏，显示第一关简单难度
      startGame('easy');
    } catch (e) {
      console.warn('auto-start easy failed', e);
    }

    // --- 作弊提示按钮（通过键盘序列解锁） ---
    // 键序：上 上 下 下 左 右 左 右
    const cheatSeq = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
    ];
    let cheatProgress = 0;
    this._hintUnlocked = false;
    let hintBtn = null;
    const keyHandler = (ev) => {
      if (this._hintUnlocked) return;
      if (ev && ev.key === cheatSeq[cheatProgress]) {
        cheatProgress++;
        if (cheatProgress >= cheatSeq.length) {
          this._hintUnlocked = true;
          cheatProgress = 0;
          // 显示提示按钮
          hintBtn = document.createElement('button');
          hintBtn.textContent = '提示';
          hintBtn.className = 'hint-btn';
          hintBtn.style.marginLeft = '0.6rem';
          // 上报作弊解锁事件，包含当前关和当前难度信息
          try {
            const currentLevelIndex =
              typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
            achievements.recordEvent('scene5:cheat_unlocked', {
              level: currentLevelIndex,
              difficulty: this.currentDifficulty,
            });
          } catch (e) {
            console.warn('ach record cheat_unlocked err', e);
          }
          hintBtn.addEventListener('click', () => {
            try {
              // 找出所有非雷、未打开、未禁用的格子
              const available = [];
              for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                  const k = idx(r, c);
                  if (disabledSet.has(k)) continue;
                  if (this.opened.has(k)) continue;
                  if (mineSet.has(k)) continue;
                  available.push([r, c]);
                }
              }
              if (available.length === 0) {
                msgEl.textContent = '没有可提示的格子了。';
                return;
              }
              const pick = available[Math.floor(Math.random() * available.length)];
              const [pr, pc] = pick;
              // 打开该格子（使用 openCell 保持行为一致）
              openCell(pr, pc);
              // 更新剩余显示
              remainEl.textContent = totalMines - this.flags.size;
              // 检查胜利
              if (checkWin()) {
                this.gameOver = true;
                revealAllMines(false);
                msgEl.textContent = '恭喜，扫雷成功！';
                try {
                  const currentLevelIndex =
                    typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
                  const lvList = this.levels && this.levels.length ? this.levels : levels;
                  const isLast = currentLevelIndex >= lvList.length - 1;
                  achievements.recordEvent('scene5:completed', {
                    level: currentLevelIndex,
                    difficulty: this.currentDifficulty,
                    final: Boolean(isLast),
                  });
                } catch (e) {
                  console.warn('ach record err', e);
                }
                // 显示下一步按钮区域（复用已有逻辑）
                const controls = el.querySelector('.ms-controls');
                let nextArea = controls.querySelector('.next-area');
                if (!nextArea) {
                  nextArea = document.createElement('div');
                  nextArea.className = 'next-area';
                  nextArea.style.marginLeft = '0.6rem';
                  controls.appendChild(nextArea);
                }
                nextArea.innerHTML = '';
                // 通过提示胜利时也需要禁用难度与重开按钮（与主分支一致）
                try {
                  const diffBtns =
                    controlsEl && Array.from(controlsEl.querySelectorAll('button[data-diff]'));
                  if (diffBtns) {
                    diffBtns.forEach((b) => {
                      b.disabled = true;
                      b.setAttribute('aria-disabled', 'true');
                      b.classList.add('disabled');
                    });
                  }
                  if (restartBtn) {
                    restartBtn.disabled = true;
                    restartBtn.setAttribute('aria-disabled', 'true');
                    restartBtn.classList.add('disabled');
                  }
                } catch (e) {}
                const currentLevelIndex =
                  typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
                const lvList = this.levels && this.levels.length ? this.levels : levels;
                const isLast = currentLevelIndex >= lvList.length - 1;
                if (!isLast) {
                  const nxt = document.createElement('button');
                  nxt.textContent = '下一关';
                  nxt.addEventListener('click', () => {
                    const nextIdx = currentLevelIndex + 1;
                    const nextLv = lvList[nextIdx];
                    if (nextLv) {
                      this.currentLevelIndex = nextIdx;
                      // 支持 rows/cols
                      this.rows = Number(nextLv.rows) || this.rows;
                      this.cols = Number(nextLv.cols) || this.cols;
                      this.mineCounts = nextLv.mineCounts || this.mineCounts;
                      this.disabled = Array.isArray(nextLv.disabled)
                        ? nextLv.disabled.map((d) => [Number(d[0]), Number(d[1])])
                        : [];
                      if (levelCurEl) levelCurEl.textContent = this.currentLevelIndex + 1;
                      if (levelTotalEl)
                        levelTotalEl.textContent =
                          this.levels && this.levels.length ? this.levels.length : levels.length;
                      const sEl = document.getElementById('ms-style');
                      if (sEl) {
                        sEl.textContent = sEl.textContent.replace(
                          /repeat\(\d+, 40px\)/,
                          `repeat(${this.cols}, 40px)`
                        );
                      }
                      // 隐藏/清除下一步区域，避免切换后仍显示
                      try {
                        const controls = el.querySelector('.ms-controls');
                        const na = controls && controls.querySelector('.next-area');
                        if (na) na.innerHTML = '';
                      } catch (e) {}
                      // 进入下一关时重新启用难度与重开按钮
                      try {
                        const diffBtns =
                          controlsEl &&
                          Array.from(controlsEl.querySelectorAll('button[data-diff]'));
                        if (diffBtns) {
                          diffBtns.forEach((b) => {
                            b.disabled = false;
                            b.removeAttribute('aria-disabled');
                            b.classList.remove('disabled');
                          });
                        }
                        if (restartBtn) {
                          restartBtn.disabled = false;
                          restartBtn.removeAttribute('aria-disabled');
                          restartBtn.classList.remove('disabled');
                        }
                      } catch (e) {}
                      startGame(this.currentDifficulty);
                    }
                  });
                  nextArea.appendChild(nxt);
                } else {
                  const nxt = document.createElement('button');
                  nxt.textContent = '进入下一幕';
                  nxt.addEventListener('click', () => {
                    if (this.ctx && typeof this.ctx.go === 'function') {
                      this.ctx.go('scarf');
                    }
                  });
                  nextArea.appendChild(nxt);
                }
              }
            } catch (e) {
              console.warn('hint err', e);
            }
          });
          controlsEl.appendChild(hintBtn);
        }
      } else {
        // mismatch -> 重置进度
        cheatProgress = 0;
      }
    };
    // 保存引用以便在 exit 时移除
    this.keyHandler = keyHandler;
    document.addEventListener('keydown', this.keyHandler);

    restartBtn.addEventListener('click', resetGame);

    // 初始构建：等待玩家选择难度后启动
    remainEl.textContent = totalMines - this.flags.size;
    this.ctx.rootEl.appendChild(el);
  }

  async exit() {
    // 停止 BGM
    audioManager.stopBGM('5', { fadeOut: 650 });
    // 清理键盘监听，避免泄露
    try {
      document.removeEventListener('keydown', this.keyHandler);
    } catch (e) {}
  }
}
