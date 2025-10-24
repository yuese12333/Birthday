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
    if (chosen && chosen.gridSize) this.gridSize = Number(chosen.gridSize) || this.gridSize;
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
      <div class='ms-wrapper'>
        <div class='ms-grid'></div>
      </div>
      <div class='ms-controls' style='margin-top:.6rem; display:flex; gap:.6rem; align-items:center;'>
        <button class='restart' data-debounce='600'>重开本关</button>
        <div class='msg' style='margin-left:auto; color:#333;'></div>
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
      .ms-grid { display:grid; grid-template-columns: repeat(${this.gridSize}, 40px); gap:6px; }
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
          if (nr >= 0 && nr < this.gridSize && nc >= 0 && nc < this.gridSize) {
            const k = idx(nr, nc);
            if (disabledSet.has(k)) continue;
            res.push([nr, nc]);
          }
        }
      return res;
    };

    const countAdjacentMines = (r, c) =>
      neighbors(r, c).reduce((a, [nr, nc]) => a + (mineSet.has(idx(nr, nc)) ? 1 : 0), 0);

    // 渲染网格（disabled 单元以 × 显示且不绑定事件）
    function buildGrid() {
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${this.gridSize}, 40px)`;
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
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
      for (let r = 0; r < this.gridSize; r++)
        for (let c = 0; c < this.gridSize; c++) {
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
        cell.textContent = String(adj);
        cell.classList.add('number-' + Math.min(adj, 4));
        return;
      }
      // 若为 0，则递归打开周围8个格子（neighbors 已排除 disabled）
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const r = row + i;
          const c = col + j;
          if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
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
      const totalCells = this.gridSize * this.gridSize - disabledSet.size;
      if (totalMines <= 0) return false; // 如果未布雷则不判定为胜利
      if (this.opened.size === totalCells - totalMines) return true;
      return false;
    };

    const onLeftClick = (r, c, cell) => {
      const key = idx(r, c);
      // 仅在有效点击（未打开、未标记、未禁用）时计数
      if (this.opened.has(key) || this.flags.has(key) || disabledSet.has(key)) return;
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
          if (this._levelClicks === 1) {
            const currentLevelIndex =
              typeof this.currentLevelIndex === 'number' ? this.currentLevelIndex : 0;
            achievements.recordEvent('scene5:first_click_mine', {
              level: currentLevelIndex,
              difficulty: this.currentDifficulty,
            });
          }
        } catch (e) {
          console.warn('ach record first_click err', e);
        }
        return;
      }
      // open
      const adj = countAdjacentMines(r, c);
      if (adj > 0) {
        // 直接打开显示数字
        this.opened.add(key);
        cell.classList.add('opened');
        cell.textContent = String(adj);
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
              this.gridSize = Number(nextLv.gridSize) || this.gridSize;
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
                  `repeat(${this.gridSize}, 40px)`
                );
              }
              // 隐藏/清除下一步区域，避免切换后仍显示
              try {
                const controls = el.querySelector('.ms-controls');
                const na = controls && controls.querySelector('.next-area');
                if (na) na.innerHTML = '';
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
              // 使用项目常见的转场调用，跳转到 scene6（如果需要改名再调整）
              this.ctx.go('transition', { next: 'scene6', style: 'flash12' });
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
              for (let r = 0; r < this.gridSize; r++) {
                for (let c = 0; c < this.gridSize; c++) {
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
                      this.gridSize = Number(nextLv.gridSize) || this.gridSize;
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
                          `repeat(${this.gridSize}, 40px)`
                        );
                      }
                      // 隐藏/清除下一步区域，避免切换后仍显示
                      try {
                        const controls = el.querySelector('.ms-controls');
                        const na = controls && controls.querySelector('.next-area');
                        if (na) na.innerHTML = '';
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
    // stop bgm for key '5' consistent with other scenes
    audioManager.stopBGM('5', { fadeOut: 650 });
    // 清理键盘监听，避免泄露
    try {
      document.removeEventListener('keydown', this.keyHandler);
    } catch (e) {}
  }
}
