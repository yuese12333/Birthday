import { BaseScene } from '../core/baseScene.js';
import { audioManager } from '../core/audioManager.js';
import { achievements } from '../core/achievements.js';

/**
 * Scene6Scarf -> 华容道玩法
 * 两关：
 * 1. 传统华容道：不同尺寸方块，核心目标块移动到出口位置。
 * 2. 数字华容道：4x4 数字滑块排列成 1..15 + 空白。
 */
export class Scene6Scarf extends BaseScene {
  async init() {
    await super.init();
    // 加载传统华容道关卡配置
    await this._loadClassicLevels();
    // 构建数字关
    this.numericLevel = {
      type: 'numeric',
      size: 4,
      tiles: this._shuffleNumeric(4),
    };
  }

  /**
   * 从外部 JSON 文件加载经典华容道关卡配置
   */
  async _loadClassicLevels() {
    const response = await fetch('./data/scene6_huarong.json');
    const data = await response.json();
    this.classicLevels = data.classicLevels.map((level) => ({
      ...level,
      type: 'classic',
    }));
  }

  constructor(ctx) {
    super(ctx);
    // === 关卡数据 ===
    this.classicLevelIndex = 0; // 当前经典关卡索引（0-based）
    this.classicLevels = []; // 从 JSON 加载的经典关卡数组
    this.numericLevel = null; // 数字关配置
    this.current = null; // 当前关卡运行时状态

    // === UI 元素 ===
    this.rootEl = null;
    this.selectedBlock = null; // 当前选中的方块 ID

    // === 数字关计时挑战 ===
    this._numericFirstCleared = false; // 是否已首次通关数字关
    this._numericLocked = false; // 完成后锁定棋盘,直到重开或计时挑战
    this._timingActive = false; // 计时器是否运行中
    this._timingStart = null; // 计时开始时间戳
    this._timerRaf = null; // requestAnimationFrame ID
    this._timerEl = null; // 计时器 DOM 元素

    // === 交互状态 ===
    this._keyBound = false; // 键盘事件是否已绑定
    this._dragState = null; // 拖动状态
  }

  /**
   * 生成随机的数字华容道布局（15-puzzle）
   * 保证空白格在右下角且布局可解
   * @param {number} n - 棋盘大小（4 表示 4×4）
   * @returns {number[]} 打乱后的数字数组（0 代表空格）
   */
  _shuffleNumeric(n) {
    const count = n * n - 1;
    const arr = Array.from({ length: count }, (_, i) => i + 1); // 生成 1..15

    // Fisher-Yates 洗牌算法
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    // 计算逆序数
    let inversions = 0;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i] > arr[j]) inversions++;
      }
    }

    // 当空白位于右下角且棋盘为偶数大小时,逆序数必须为偶数才可解
    if (n % 2 === 0 && inversions % 2 === 1) {
      // 交换前两项调整为偶数逆序
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }

    // 将空白格（0）放到最后
    arr.push(0);
    return arr;
  }

  async enter() {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'scene scene-scarf hrd';
    this.applyNoSelect(this.rootEl);
    this._injectStyle();
    try {
      audioManager.playSceneBGM('6', { loop: true, volume: 0.6, fadeIn: 600 });
    } catch (e) {}
    this.ctx.rootEl.appendChild(this.rootEl);
    // 进入场景时加载第一个经典关卡
    this.loadLevel('classic', this.classicLevelIndex);
  }

  /**
   * 加载指定关卡
   * @param {string} type - 关卡类型: 'classic' 或 'numeric'
   * @param {number} idx - 关卡索引(仅对 classic 类型有效)
   */
  loadLevel(type, idx = 0) {
    let def;
    if (type === 'classic') {
      if (!this.classicLevels || idx >= this.classicLevels.length) return;
      this.classicLevelIndex = idx;
      def = this.classicLevels[idx];
    } else {
      def = this.numericLevel;
    }

    if (def.type === 'classic') {
      this.current = JSON.parse(JSON.stringify(def)); // 深拷贝
      // 将 horizontal 字段转换为 w/h 字段(兼容 1/0 和 true/false 两种格式)
      this.current.blocks = this.current.blocks.map((b) => {
        const nb = Object.assign({}, b);
        const h = typeof nb.horizontal === 'number' ? nb.horizontal === 1 : !!nb.horizontal;
        if (h) {
          nb.w = 2;
          nb.h = 1;
        } else {
          nb.w = 1;
          nb.h = 2;
        }
        delete nb.horizontal;
        return nb;
      });
      this._renderClassic();
    } else if (def.type === 'numeric') {
      // 每次进入/重开数字关都重新洗牌以保证随机性
      def.tiles = this._shuffleNumeric(def.size);
      // 解锁数字棋盘(每次加载新关或重开都应可操作)
      this._numericLocked = false;
      this.current = JSON.parse(JSON.stringify(def));
      this._renderNumeric();
    }
  }

  _clearRoot() {
    this.rootEl.innerHTML = '';
  }

  _renderHeader(title) {
    const bar = document.createElement('div');
    bar.className = 'hrd-top-bar';
    bar.innerHTML = `
      <h1>场景6：华容道 - ${title}</h1>
      <div class='hrd-controls'>
        <button data-act='restart'>重开关卡</button>
      </div>
    `;
    bar.querySelector('[data-act=restart]').addEventListener('click', () => {
      // 如果当前在数字关，并且处于计时挑战（计时进行中）或页面已有“计时挑战”按钮，
      // 则将重开视为重新开始计时挑战：停止当前计时（若在运行），再执行三秒倒计时流程
      if (this.current && this.current.type === 'numeric') {
        const controls = this.rootEl.querySelector('.hrd-top-bar .hrd-controls');
        const hasTimingBtn = controls && controls.querySelector('[data-act=timing]');
        if (this._timingActive || hasTimingBtn) {
          if (this._timingActive) this._stopTiming();
          this._startNumericChallengeCountdown();
          return;
        }
      }
      // 默认行为：重开当前关卡
      if (this.current && this.current.type === 'classic') {
        this.loadLevel('classic', this.classicLevelIndex);
      } else {
        this.loadLevel('numeric');
      }
    });
    this.rootEl.appendChild(bar);
  }

  /**
   * 渲染经典华容道关卡
   */
  _renderClassic() {
    this._clearRoot();

    // 动态生成标题
    const totalClassic = this.classicLevels ? this.classicLevels.length : 0;
    const currentIdx = this.classicLevelIndex + 1;
    const levelName = this.current.name || '经典布局';
    const headerTitle = `${levelName} - 第${currentIdx}关/共${totalClassic}关`;

    this._renderHeader(headerTitle);
    const { cols, rows, blocks, exit } = this.current;
    const wrap = document.createElement('div');
    wrap.className = 'hrd-board classic';
    // 如果出口在右侧且需要在棋盘外显示，则扩展视觉列数
    const exitOrientation = exit.orientation || 'bottom';
    const visualCols = exitOrientation === 'right' ? cols + (exit.w || 1) : cols;
    wrap.style.setProperty('--cols', visualCols);
    wrap.style.setProperty('--rows', rows);

    const grid = document.createElement('div');
    grid.className = 'hrd-grid';

    // 添加可视边框,围绕逻辑棋盘区域
    const playAreaBorder = document.createElement('div');
    playAreaBorder.className = 'play-area-border';
    // 覆盖整个棋盘区域：从 (1,1) 到 (rows+1, cols+1)
    playAreaBorder.style.gridArea = `1 / 1 / ${rows + 1} / ${cols + 1}`;
    grid.appendChild(playAreaBorder);

    // 若为右侧外置出口，制造边框缺口遮罩
    if (exitOrientation === 'right') {
      // 计算单元尺寸与缺口定位
      // 优先通过已渲染样式推断 cellHeight；若无块，使用基准 80px
      const baseCellSize = parseInt(
        getComputedStyle(grid)
          .getPropertyValue('grid-template-rows')
          .match(/(\d+)px/)?.[1] || '80'
      );
      // 自适应媒体查询后实际 cell 高度可能变化，尝试测量一个暂时创建的占位节点
      let measuredCell = baseCellSize;
      const probe = document.createElement('div');
      probe.style.gridArea = '1 / 1 / 2 / 2';
      probe.style.visibility = 'hidden';
      grid.appendChild(probe);
      measuredCell = probe.getBoundingClientRect().height || baseCellSize;
      probe.remove();
      const gap = 4; // 与CSS中gap一致
      const notchTop = exit.y * (measuredCell + gap);
      const notchHeight = exit.h * measuredCell + (exit.h - 1) * gap;
      const notch = document.createElement('div');
      notch.className = 'exit-notch';
      notch.style.top = notchTop + 'px';
      notch.style.height = notchHeight + 'px';
      // 位置：在内部棋盘右侧（playAreaBorder 内部右边缘）绝对定位
      notch.style.right = '0';
      grid.appendChild(notch);
    }

    // 出口标记：若为右侧出口则放在棋盘外（忽略 JSON 中的 x）
    const exitEl = document.createElement('div');
    if (exitOrientation === 'right') {
      exitEl.className = 'exit outside right';
      const startCol = cols + 1; // 外部第一列
      const endCol = cols + (exit.w || 1) + 1;
      exitEl.style.gridArea = `${exit.y + 1} / ${startCol} / ${exit.y + exit.h + 1} / ${endCol}`;
    } else {
      exitEl.className = 'exit';
      exitEl.style.gridArea = `${exit.y + 1} / ${exit.x + 1} / ${exit.y + exit.h + 1} / ${
        exit.x + exit.w + 1
      }`;
    }
    grid.appendChild(exitEl);

    // 方块元素
    blocks.forEach((b) => {
      const blockEl = document.createElement('div');
      blockEl.className = 'block' + (b.type === 'target' ? ' target' : '');
      blockEl.dataset.id = b.id;
      blockEl.style.gridArea = `${b.y + 1} / ${b.x + 1} / ${b.y + b.h + 1} / ${b.x + b.w + 1}`;
      // 不显示字母标识
      blockEl.textContent = '';
      // 点击选中
      blockEl.addEventListener('click', () => this._selectBlock(b.id));
      // pointerdown 用于开始拖动（支持鼠标与触控）
      blockEl.addEventListener('pointerdown', (ev) => this._startDrag(ev, b));
      grid.appendChild(blockEl);
    });

    wrap.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'hrd-hint';
    hint.textContent = '点击方块并使用方向键移动，目标块从出口滑出即胜利。';
    wrap.appendChild(hint);
    this.rootEl.appendChild(wrap);
    this.selectedBlock = null;

    // 键盘监听
    this._bindKeyHandler();
  }

  _selectBlock(id) {
    // 更新选中样式
    const prev = this.selectedBlock;
    this.selectedBlock = id;
    if (prev) {
      const pel = this.rootEl.querySelector(`.block[data-id='${prev}']`);
      if (pel) pel.classList.remove('selected');
    }
    const el = this.rootEl.querySelector(`.block[data-id='${id}']`);
    if (el) el.classList.add('selected');
  }

  _startDrag(ev, block) {
    ev.preventDefault();
    // 记录拖动起点
    this._dragState = {
      id: block.id,
      startX: ev.clientX,
      startY: ev.clientY,
      gridRect: this.rootEl.querySelector('.hrd-grid').getBoundingClientRect(),
    };
    // 确保选中
    this._selectBlock(block.id);
    // 监听 pointerup 在 window 上
    const up = (e) => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
      this._endDrag(e);
    };
    const move = (e) => {
      // 可在此添加拖动过程中视觉反馈（略）
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  _endDrag(ev) {
    if (!this._dragState) return;
    const s = this._dragState;
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    const grid = this.rootEl.querySelector('.hrd-grid');
    // 使用视觉列数/行数来计算单元尺寸（考虑 visualOffset 扩展）
    const cols = this.current.cols;
    const rows = this.current.rows;
    const rect = s.gridRect || grid.getBoundingClientRect();
    // 若 grid 的 --cols 是视觉列数，则以其为准来计算 cell 大小
    const styleCols = parseInt(getComputedStyle(grid).getPropertyValue('--cols')) || cols;
    const styleRows = parseInt(getComputedStyle(grid).getPropertyValue('--rows')) || rows;
    const cellW = rect.width / styleCols;
    const cellH = rect.height / styleRows;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = Math.min(cellW, cellH) * 0.25; // 至少四分之一格
    let dir = null;
    if (absX < threshold && absY < threshold) {
      // 视为点击，不移动
      this._dragState = null;
      return;
    }
    if (absX > absY) {
      dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    } else {
      dir = dy > 0 ? 'ArrowDown' : 'ArrowUp';
    }
    // 执行一次移动（单格）
    const id = s.id;
    const b = this.current.blocks.find((x) => x.id === id);
    if (!b) {
      this._dragState = null;
      return;
    }
    let mv = { dx: 0, dy: 0 };
    if (dir === 'ArrowLeft') mv.dx = -1;
    else if (dir === 'ArrowRight') mv.dx = 1;
    else if (dir === 'ArrowUp') mv.dy = -1;
    else if (dir === 'ArrowDown') mv.dy = 1;
    if (this._canMoveBlock(b, mv.dx, mv.dy)) {
      b.x += mv.dx;
      b.y += mv.dy;
      this._updateClassicBlockEl(b);
      this._checkClassicWin();
    } else {
      // 非法拖动尝试，沿尝试方向抖动
      this._shakeBlock(b, mv.dx, mv.dy);
    }
    this._dragState = null;
  }

  _bindKeyHandler() {
    if (this._keyBound) return;
    this._keyBound = true;
    window.addEventListener('keydown', (e) => {
      if (!this.current) return;
      if (this.current.type === 'classic') {
        this._handleClassicMove(e.key);
      } else if (this.current.type === 'numeric') {
        this._handleNumericMove(e.key);
      }
    });
  }

  _handleClassicMove(key) {
    if (!this.selectedBlock) return;
    const b = this.current.blocks.find((x) => x.id === this.selectedBlock);
    if (!b) return;
    let dx = 0,
      dy = 0;
    // 支持 Arrow Keys 与 WASD（大小写）
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') dx = -1;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') dx = 1;
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') dy = -1;
    else if (key === 'ArrowDown' || key === 's' || key === 'S') dy = 1;
    else return;
    if (dx === 0 && dy === 0) return;
    if (this._canMoveBlock(b, dx, dy)) {
      b.x += dx;
      b.y += dy;
      this._updateClassicBlockEl(b);
      this._checkClassicWin();
    } else {
      // 非法移动尝试抖动反馈(按碰撞方向)
      this._shakeBlock(b, dx, dy);
    }
  }

  /**
   * 检查方块是否可以移动到指定位置
   * @param {Object} b - 要移动的方块对象
   * @param {number} dx - x 方向移动增量
   * @param {number} dy - y 方向移动增量
   * @returns {boolean} 是否可以移动
   */
  _canMoveBlock(b, dx, dy) {
    const { cols, rows, blocks } = this.current;
    const nx = b.x + dx;
    const ny = b.y + dy;

    // 边界检查(目标块可以向下"出界"到出口位置)
    if (nx < 0 || ny < 0 || nx + b.w > cols || ny + b.h > rows) {
      const exit = this.current.exit;
      const ori = exit.orientation || 'bottom';
      // 目标块允许进入外部出口区域（逐步滑出），其他块禁止越界
      if (b.type === 'target') {
        if (ori === 'right') {
          // 进入右侧出口：保持行匹配，向右移动，且越界不超过出口宽度
          const maxRight = cols + (exit.w || 1); // 目标块右侧边界允许值 (exclusive line index)
          const afterRightEdge = b.y === exit.y && b.h === exit.h && dx > 0 && nx + b.w <= maxRight;
          if (!afterRightEdge) return false;
        } else if (ori === 'bottom') {
          const maxBottom = rows + (exit.h || 1);
          const afterBottomEdge =
            b.x === exit.x && b.w === exit.w && dy > 0 && ny + b.h <= maxBottom;
          if (!afterBottomEdge) return false;
        } else {
          return false; // 未定义的出口方向
        }
      } else {
        return false; // 非目标块禁止越界
      }
    }

    // 碰撞检测(忽略自身)
    return blocks.every((other) => {
      if (other.id === b.id) return true;
      const ox = other.x,
        oy = other.y,
        ow = other.w,
        oh = other.h;
      const overlapX = nx < ox + ow && nx + b.w > ox;
      const overlapY = ny < oy + oh && ny + b.h > oy;
      if (overlapX && overlapY) return false;
      return true;
    });
  }

  _updateClassicBlockEl(b) {
    const el = this.rootEl.querySelector(`.block[data-id='${b.id}']`);
    if (el) {
      // 视觉与逻辑统一：直接使用真实坐标
      el.style.gridArea = `${b.y + 1} / ${b.x + 1} / ${b.y + b.h + 1} / ${b.x + b.w + 1}`;
    }
  }

  /**
   * 非法移动时抖动方块，按照玩家尝试的碰撞方向抖动
   * @param {Object} b 方块对象
   * @param {number} dx 本次尝试移动的 x 增量(-1/0/1)
   * @param {number} dy 本次尝试移动的 y 增量(-1/0/1)
   */
  _shakeBlock(b, dx, dy) {
    const el = this.rootEl.querySelector(`.block[data-id='${b.id}']`);
    if (!el) return;
    // 判断尝试方向：有水平位移则水平抖动，否则垂直抖动
    const cls = Math.abs(dx) !== 0 ? 'shake-h' : 'shake-v';
    el.classList.remove('shake-h', 'shake-v');
    void el.offsetWidth; // 强制重排以重启动画
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 400);
  }

  /**
   * 检查经典华容道是否胜利
   * 胜利条件: 目标块(type='target')到达出口位置
   */
  _checkClassicWin() {
    const target = this.current.blocks.find((x) => x.type === 'target');
    const { exit, rows } = this.current;
    const cols = this.current.cols;
    const ori = exit.orientation || 'bottom';
    const bottomWin =
      ori === 'bottom' &&
      target.x === exit.x &&
      target.w === exit.w &&
      target.y + target.h >= rows + (exit.h || 1); // 完全滑出
    const rightWin =
      ori === 'right' &&
      target.y === exit.y &&
      target.h === exit.h &&
      target.x + target.w >= cols + (exit.w || 1); // 完全滑出
    if (bottomWin || rightWin) {
      this._showWin(() => {
        // 检查是否还有更多经典关卡
        const nextClassicIdx = this.classicLevelIndex + 1;
        if (nextClassicIdx < this.classicLevels.length) {
          // 进入下一个经典关卡
          this.loadLevel('classic', nextClassicIdx);
        } else {
          // 所有经典关卡完成,进入数字关
          this.loadLevel('numeric');
        }
      });
    }
  }

  /**
   * 渲染数字华容道关卡
   */
  _renderNumeric() {
    this._clearRoot();
    this._renderHeader('数字滑块');
    const { size, tiles } = this.current;
    const wrap = document.createElement('div');
    wrap.className = 'hrd-board numeric';
    wrap.style.setProperty('--cols', size);
    wrap.style.setProperty('--rows', size);
    const grid = document.createElement('div');
    grid.className = 'hrd-grid';

    // 渲染数字块(不渲染背景空格,只显示数字)
    tiles.forEach((val, i) => {
      if (val === 0) return; // 跳过空白格
      const tileEl = document.createElement('div');
      tileEl.className = 'num-tile';
      const r = Math.floor(i / size);
      const c = i % size;
      tileEl.style.gridArea = `${r + 1} / ${c + 1} / ${r + 2} / ${c + 2}`;
      tileEl.textContent = val;
      tileEl.addEventListener('click', () => this._tryMoveNumeric(r, c));
      grid.appendChild(tileEl);
    });
    wrap.appendChild(grid);
    this.rootEl.appendChild(wrap);
    this._bindKeyHandler();
  }

  _findNumericBlank() {
    const idx = this.current.tiles.indexOf(0);
    const size = this.current.size;
    return { r: Math.floor(idx / size), c: idx % size };
  }

  _handleNumericMove(key) {
    const blank = this._findNumericBlank();
    let tr = blank.r,
      tc = blank.c;
    // 支持 Arrow 与 WASD（W 上, S 下, A 左, D 右）
    if (key === 'ArrowUp' || key === 'w' || key === 'W') tr = blank.r - 1;
    else if (key === 'ArrowDown' || key === 's' || key === 'S') tr = blank.r + 1;
    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') tc = blank.c - 1;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') tc = blank.c + 1;
    else return;
    this._tryMoveNumeric(tr, tc);
  }

  _tryMoveNumeric(r, c) {
    // 若数字关已被锁定（已完成），不允许再移动，直到重开或进入计时挑战
    if (this._numericLocked) return;
    const { size, tiles } = this.current;
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    const blank = this._findNumericBlank();
    const manhattan = Math.abs(blank.r - r) + Math.abs(blank.c - c);
    if (manhattan !== 1) return; // 必须相邻
    // 交换
    const blankIdx = blank.r * size + blank.c;
    const tileIdx = r * size + c;
    [tiles[blankIdx], tiles[tileIdx]] = [tiles[tileIdx], tiles[blankIdx]];
    this._updateNumericTiles();
    this._checkNumericWin();
  }

  _updateNumericTiles() {
    const { size, tiles } = this.current;
    // 清除现有数字元素
    const grid = this.rootEl.querySelector('.numeric .hrd-grid');
    grid.querySelectorAll('.num-tile').forEach((el) => el.remove());
    tiles.forEach((val, i) => {
      if (val === 0) return;
      const r = Math.floor(i / size);
      const c = i % size;
      const tileEl = document.createElement('div');
      tileEl.className = 'num-tile';
      tileEl.style.gridArea = `${r + 1} / ${c + 1} / ${r + 2} / ${c + 2}`;
      tileEl.textContent = val;
      tileEl.addEventListener('click', () => this._tryMoveNumeric(r, c));
      grid.appendChild(tileEl);
    });
  }

  _checkNumericWin() {
    const { tiles } = this.current;
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i] !== i + 1) return;
    }
    if (tiles[tiles.length - 1] !== 0) return;
    // 如果处于计时挑战模式，优先走计时胜利流程
    if (this._timingActive) {
      const elapsed = this._stopTiming();
      if (elapsed !== null) {
        // 计时挑战完成事件（用于成就 6-1 判定）
        try {
          achievements.recordEvent('scene6:timed_finish', { elapsed });
        } catch (e) {}
        this._showTimedWin(elapsed);
        return;
      }
    }
    // 首次通过数字关:仅显示确认按钮,确认后显示"计时挑战"和"跳转下一幕"按钮
    if (!this._numericFirstCleared) {
      this._numericFirstCleared = true;
      // 上报第六幕完成成就事件（首次完成数字华容道）
      try {
        achievements.recordEvent('scene6:completed', { firstNumeric: true });
      } catch (e) {}
      this._showNumericFirstWin();
      // 锁定棋盘,直到用户选择计时挑战或重开
      this._numericLocked = true;
    }
  }
  /**
   * 显示首次完成数字关的胜利弹窗
   */
  _showNumericFirstWin() {
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'>🎉 数字华容道 通过！<button class='confirm-btn'>确认</button></div>`;
    this.rootEl.appendChild(box);
    box.querySelector('.confirm-btn').addEventListener('click', () => {
      box.remove();
      this._injectPostNumericWinButtons();
    });
  }

  /**
   * 在顶部注入"计时挑战"和"跳转下一幕"按钮
   */
  _injectPostNumericWinButtons() {
    // 在顶部控制区添加"计时挑战"和"跳转下一幕"按钮，若已存在则先清理旧的
    const controls = this.rootEl.querySelector('.hrd-top-bar .hrd-controls');
    if (!controls) return;
    // 避免重复添加
    if (controls.querySelector('[data-act=timing]')) return;
    const timingBtn = document.createElement('button');
    timingBtn.textContent = '计时挑战';
    timingBtn.dataset.act = 'timing';
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '跳转下一幕';
    nextBtn.dataset.act = 'goto-next';
    controls.appendChild(timingBtn);
    controls.appendChild(nextBtn);
    timingBtn.addEventListener('click', () => {
      // 开启倒计时挑战
      this._startNumericChallengeCountdown();
    });
    nextBtn.addEventListener('click', () => {
      // 直接跳转下一幕(不再弹出确认弹窗)
      this._gotoNextScene();
    });
  }

  /**
   * 跳转到下一场景
   */
  _gotoNextScene() {
    // 跳转到下一场景
    if (this.ctx && this.ctx.go) {
      this.ctx.go('future');
    }
  }

  /**
   * 开始数字关计时挑战的倒计时
   * 显示 3...2...1...Go! 后重新开始数字关并启动计时器
   */
  _startNumericChallengeCountdown() {
    // 显示 3 秒倒计时在屏幕中央，然后重开数字关并开始计时器
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'><div class='countdown'>3</div></div>`;
    this.rootEl.appendChild(box);
    let count = 3;
    const iv = setInterval(() => {
      count -= 1;
      const el = box.querySelector('.countdown');
      if (el) el.textContent = String(count > 0 ? count : 'Go!');
      if (count <= 0) {
        clearInterval(iv);
        box.remove();
        // 重新开始数字关(洗牌并渲染)并开始计时
        this.loadLevel('numeric');
        // 允许一帧后开始计时以保证 UI 渲染
        requestAnimationFrame(() => this._startTiming());
      }
    }, 1000);
  }

  /**
   * 启动计时器
   */
  _startTiming() {
    if (this._timingActive) return;
    this._timingActive = true;
    this._timingStart = performance.now();
    // 在界面上显示计时器（顶部）
    this._timerEl = document.createElement('div');
    this._timerEl.className = 'hrd-timer';
    this._timerEl.style.cssText =
      'position:fixed;top:12px;right:12px;background:rgba(0,0,0,0.6);color:#fff;padding:6px 10px;border-radius:6px;z-index:9999;';
    this._timerEl.textContent = '计时: 0.00s';
    document.body.appendChild(this._timerEl);
    const update = () => {
      if (!this._timingActive) return;
      const now = performance.now();
      const sec = (now - this._timingStart) / 1000;
      // 显示到毫秒 (3 位小数)
      if (this._timerEl) this._timerEl.textContent = `计时: ${sec.toFixed(3)}s`;
      this._timerRaf = requestAnimationFrame(update);
    };
    this._timerRaf = requestAnimationFrame(update);
  }

  /**
   * 停止计时器并返回经过的时间(秒)
   * @returns {number|null} 经过的时间(秒),如果计时器未运行则返回 null
   */
  _stopTiming() {
    if (!this._timingActive) return null;
    this._timingActive = false;
    const elapsed = (performance.now() - this._timingStart) / 1000;
    this._timingStart = null;
    if (this._timerRaf) cancelAnimationFrame(this._timerRaf);
    this._timerRaf = null;
    if (this._timerEl) {
      this._timerEl.remove();
      this._timerEl = null;
    }
    return elapsed;
  }

  /**
   * 显示计时挑战胜利弹窗
   * @param {number} elapsed - 完成时间(秒)
   */
  _showTimedWin(elapsed) {
    // 在弹窗中显示胜利与用时，并比较 localStorage 最佳成绩
    const bestKey = 'hrd_numeric_best';
    const best = parseFloat(localStorage.getItem(bestKey)) || 0;
    let newRecord = false;
    if (best === 0 || elapsed < best) {
      localStorage.setItem(bestKey, String(elapsed));
      newRecord = true;
    }
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `
      <div class='inner'>
        <div>🎉 胜利！</div>
        <div>用时: ${elapsed.toFixed(3)}s</div>
        ${newRecord ? "<div style='color:#d32f2f;font-weight:bold'>新纪录！</div>" : ''}
        <button class='confirm-btn'>确认</button>
      </div>
    `;
    this.rootEl.appendChild(box);
    box.querySelector('.confirm-btn').addEventListener('click', () => {
      box.remove();
      // 不跳转，重新确保顶部存在“计时挑战”和“跳转下一幕”按钮
      this._injectPostNumericWinButtons();
    });
  }

  /**
   * 显示通用胜利弹窗
   * @param {Function} cb - 点击"继续"按钮后的回调函数
   */
  _showWin(cb) {
    const box = document.createElement('div');
    box.className = 'hrd-win';
    box.innerHTML = `<div class='inner'>🎉 胜利！<button class='next-btn'>继续</button></div>`;
    this.rootEl.appendChild(box);
    box.querySelector('.next-btn').addEventListener('click', () => {
      box.remove();
      cb && cb();
    });
  }

  /**
   * 注入全局样式表
   */
  _injectStyle() {
    if (document.getElementById('hrd-style')) return;
    const style = document.createElement('style');
    style.id = 'hrd-style';
    style.textContent = `
      .scene-scarf.hrd { padding: 20px; }
      .hrd-top-bar { display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px; }
      .hrd-top-bar h1 { font-size:20px;margin:0; }
      .hrd-controls button { margin-right:8px;padding:4px 10px; }
      .hrd-board { max-width:500px;margin:0 auto; }
      .hrd-grid { display:grid;grid-template-columns:repeat(var(--cols), 80px);grid-template-rows:repeat(var(--rows), 80px);gap:4px;position:relative; }
      .hrd-grid .cell { width:80px;height:80px;background:#f3f3f3;border-radius:6px;box-shadow:inset 0 0 2px #bbb; }
      .play-area-border { box-shadow: 0 0 0 4px rgba(43,140,255,0.12) inset, 0 0 0 2px rgba(43,140,255,0.22); border-radius:10px; pointer-events:none; }
      .hrd-grid .exit { background: repeating-linear-gradient(45deg,#ffe0e0,#ffe0e0 6px,#ffcaca 6px,#ffcaca 12px);opacity:0.9;border:2px dashed #ff5252;border-radius:6px; }
      .hrd-grid .exit.right { background: linear-gradient(90deg, #ffe8d1 0%, #ffbe9e 70%); position:relative; border:2px solid #ff8a47; }
      .hrd-grid .exit.right::after { content:'→'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:32px; color:#d84315; animation: exitPulse 1.2s infinite; }
      /* 外部右侧出口增加分离感 */
      .hrd-grid .exit.outside.right { box-shadow:0 0 0 3px rgba(255,138,71,0.35), inset 0 0 6px rgba(255,138,71,0.5); margin-left:4px; }
      /* 缺口遮罩：覆盖原右侧边框以形成开口 */
      .exit-notch { position:absolute; width:6px; background: #fff; box-shadow:none; pointer-events:none; border-radius:3px; }
      @keyframes exitPulse { 0%{ transform:translate(-50%,-50%) scale(1); opacity:.75;} 50%{ transform:translate(-50%,-50%) scale(1.15); opacity:1;} 100%{ transform:translate(-50%,-50%) scale(1); opacity:.75;} }
      .block { background:#87c5ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#124e7a;box-shadow:0 2px 4px rgba(0,0,0,.25);cursor:pointer;user-select:none; }
      .block.selected { outline:3px solid #2b8cff; transform: translateY(-2px); }
      .block.target { background:#e53935;color:#fff;border:2px solid rgba(0,0,0,0.08); }
      /* 抖动动画 */
      .block.shake-h { animation: shakeH 0.35s ease; }
      .block.shake-v { animation: shakeV 0.35s ease; }
      @keyframes shakeH { 0%{ transform:translateX(0);} 20%{ transform:translateX(-5px);} 40%{ transform:translateX(5px);} 60%{ transform:translateX(-4px);} 80%{ transform:translateX(4px);} 100%{ transform:translateX(0);} }
      @keyframes shakeV { 0%{ transform:translateY(0);} 20%{ transform:translateY(-5px);} 40%{ transform:translateY(5px);} 60%{ transform:translateY(-4px);} 80%{ transform:translateY(4px);} 100%{ transform:translateY(0);} }
      .hrd-hint { text-align:center;margin-top:8px;font-size:12px;color:#666; }
      .num-tile { background:#ffe08a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:22px;color:#7a4e12;box-shadow:0 2px 4px rgba(0,0,0,.25);cursor:pointer;user-select:none; }
      .hrd-win { position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45); }
      .hrd-win .inner { background:#fff;padding:24px 32px;border-radius:12px;font-size:20px;display:flex;flex-direction:column;align-items:center;gap:14px; }
      .hrd-win button { padding:6px 16px;font-size:16px; }
      @media (max-width:600px){ .hrd-grid { grid-template-columns:repeat(var(--cols), 60px);grid-template-rows:repeat(var(--rows), 60px); } .hrd-grid .cell { width:60px;height:60px; } }
    `;
    document.head.appendChild(style);
  }

  async exit() {
    audioManager.stopBGM('6', { fadeOut: 500 });
  }
}
