# Scene4 推箱子关卡设计文档

## 总体架构

### 数据结构

```json
{
  "levels": [
    {
      "id": 1,
      "name": "基础关卡",
      "type": "standard",
      "map": [
        ["#", "#", "#", "#", "#", "#", "#", "#"],
        ["#", " ", " ", " ", ".", " ", " ", "#"],
        ["#", " ", " ", "$", "$", " ", " ", "#"],
        ["#", " ", " ", "@", " ", " ", " ", "#"],
        ["#", " ", " ", " ", ".", " ", " ", "#"],
        ["#", "#", "#", "#", "#", "#", "#", "#"]
      ],
      "config": {}
    },
    {
      "id": 2,
      "name": "步数限制",
      "type": "step-limit",
      "map": ["###...", "..."],
      "config": {
        "maxMoves": 20
      }
    },
    {
      "id": 3,
      "name": "颜色匹配",
      "type": "color-match",
      "map": ["###...", "..."],
      "config": {
        "boxes": [
          { "pos": [2, 3], "color": "red" },
          { "pos": [3, 4], "color": "blue" }
        ],
        "targets": [
          { "pos": [5, 6], "color": "red" },
          { "pos": [6, 7], "color": "blue" }
        ]
      }
    },
    {
      "id": 4,
      "name": "冰面滑行",
      "type": "ice-sliding",
      "map": [
        ["#", "#", "#", "#", "#", "#", "#", "#"],
        ["#", " ", " ", " ", ".", " ", " ", "#"],
        ["#", " ", "$", "$", " ", " ", "#", "#"],
        ["#", " ", " ", "@", " ", "$", " ", "#"],
        ["#", " ", " ", " ", ".", " ", " ", "#"],
        ["#", "#", "#", "#", "#", "#", "#", "#"]
      ],
      "config": {
        "iceFloor": true,
        "markerEnabled": true,
        "maxMarkers": 1
      }
    }
  ]
}
```

---

## 第一关：标准玩法

### 机制

- **规则**：经典推箱子，推动所有箱子到目标点即可通关
- **符号**：
  - `#` 墙
  - ` ` 地板
  - `.` 目标
  - `$` 箱子
  - `@` 玩家
  - `*` 箱子在目标上
  - `+` 玩家在目标上

### 关卡地图示例

```
##########
#   .    #
#  $  $  #
#   @    #
#   .    #
##########
```

### 胜利条件

- 所有目标点 (`.`) 上都有箱子 (`*`)

### 实现要点

- 已完成基础实现
- 需要添加关卡选择 UI
- 需要添加"下一关"按钮（第 1 关通关后显示）

---

## 第二关：步数限制

### 机制

- **新增规则**：玩家必须在规定步数内完成关卡
- **步数计数**：
  - 移动计步（包括推箱子的移动）
  - 原地转向不计步
  - 重置关卡会重置步数

### 数据结构扩展

```json
{
  "type": "step-limit",
  "map": ["..."],
  "config": {
    "maxMoves": 25,
    "optimalMoves": 18
  }
}
```

### UI 元素

- 实时显示当前步数 / 最大步数：`步数：12 / 25`
- 步数接近上限时（剩余 < 5 步）文字变红色并闪烁提醒
- 超过步数限制时显示失败提示："步数用尽，按 R 重置"

### 胜利条件

- 所有箱子到达目标点 **且** 步数 ≤ 最大步数
- 可选：显示评级（优秀 / 良好 / 及格）

### 失败条件

- 步数达到上限但未完成 → 禁用移动，显示重置提示

### 关卡地图示例

```
############
#  .   .   #
# $  @  $  #
#          #
############
最大步数：15
最优步数：12
```

### 实现要点

- 新增 `moveCount` 变量
- 每次 `move()` 成功后 `moveCount++`
- 在 `move()` 开头检查 `moveCount >= maxMoves` 则返回
- 在 UI 中实时更新步数显示
- `resetLevel()` 时重置 `moveCount = 0`
- 修改 `checkWin()` 同时检查步数条件

---

## 第三关：颜色匹配

### 机制

- **新增规则**：箱子和目标点都有颜色属性，必须将对应颜色的箱子推到对应颜色的目标点
- **颜色方案**：
  - 红色：`$R` / `.R` → 显示为红色背景/边框
  - 蓝色：`$B` / `.B` → 显示为蓝色背景/边框
  - 绿色：`$G` / `.G` → 显示为绿色背景/边框
  - 黄色：`$Y` / `.Y` → 显示为黄色背景/边框

### 数据结构扩展

```javascript
// 在 JSON 中使用扩展格式：
{
  "type": "color-match",
  "map": ["基础地图布局（不含箱子和目标）"],
  "entities": {
    "boxes": [
      {"row": 2, "col": 3, "color": "red"},
      {"row": 2, "col": 5, "color": "blue"}
    ],
    "targets": [
      {"row": 4, "col": 3, "color": "red"},
      {"row": 4, "col": 5, "color": "blue"}
    ]
  }
}
```

### 视觉设计

- 箱子：在原背景色基础上叠加半透明色块
  - 红箱子：`background: linear-gradient(rgba(255,0,0,0.4), rgba(255,0,0,0.4)), #ffcf7c`
  - 蓝箱子：`background: linear-gradient(rgba(0,100,255,0.4), rgba(0,100,255,0.4)), #ffcf7c`
- 目标点：用彩色边框区分
  - 红目标：`box-shadow: inset 0 0 0 3px #ff4444`
  - 蓝目标：`box-shadow: inset 0 0 0 3px #4488ff`

### 胜利条件

- 所有箱子都在**匹配颜色**的目标点上
- 错误匹配（红箱子在蓝目标）不计入完成

### 关卡地图示例

```
##########
#  .R .B #
#        #
#  $R $B #
#   @    #
##########
```

### 实现要点

- 扩展 `loadLevel()` 支持读取 `entities` 配置
- 修改 `boxes` 从 `Set<string>` 改为 `Map<string, {color?:string}>`
- 修改 `targets` 从 `Set<string>` 改为 `Map<string, {color?:string}>`
- 修改 `checkWin()` 增加颜色匹配检查
- 修改 `render()` 根据颜色属性应用 CSS 类

---

## 第四关：冰面滑行 + 标记系统（实现说明）

### 机制

- 冰面效果：推动箱子后，箱子会沿推动方向持续滑行，直到遇到墙、其他箱子或玩家放置的标记为止。
- 标记系统：玩家可以放置一个（或受限数量的）标记来截停滑行中的箱子。标记不阻挡玩家移动，且不能放在箱子或墙上。

### 数据结构与配置

示例关卡对象依然支持 `type: "ice-sliding"`，并在 `config` 中包含：

```json
{
  "type": "ice-sliding",
  "map": ["..."],
  "config": {
    "slideEnabled": true,
    "maxMarkers": 1
  }
}
```

（可选扩展）可以在 `config` 中增加 `markImage` 字段来为该关定制标记使用的贴图路径，渲染会优先使用该字段。

### 滑行逻辑

滑行算法如前所述：从箱子被推动后的位置沿方向持续前进，遇到停止条件（墙、箱子或标记）时停下。示例：

```javascript
function slideBox(startRow, startCol, dr, dc) {
  let r = startRow,
    c = startCol;
  while (true) {
    const nr = r + dr,
      nc = c + dc;
    if (isWall(nr, nc)) break;
    if (boxes.has(idx(nr, nc))) break;
    if (marker && marker.r === nr && marker.c === nc) break;
    r = nr;
    c = nc;
  }
  return { r, c };
}
```

### 标记系统（实现细节）

- 标记现在以格子背景替换的方式呈现（不再依赖浮动 DOM 元素）：被标记的格子会添加 `marked` 类，CSS 将该格的背景替换为 `./assets/images/Ground_Mark.png`（第四关 ice 地面可仍使用 `Ground_Ice.png`，但标记会覆盖为 `Ground_Mark.png`）。
- 放置/移除标记的快捷键：`F`（大小写均可）。鼠标右键切换标记的交互已移除。
- 标记限制由 `config.maxMarkers` 控制；当前实现通常为 1。
- 重置关卡（`R` 或重置按钮）在 `loadLevel()` 时会把 `marker = null`，并在调用 `render()` 前生效，因此重置后标记会立即消失。

示意函数（摘要）：

```javascript
let marker = null; // {r,c} 或 null

function placeMarker() {
  if (!config || !config.maxMarkers) return;
  if (marker) return;
  const key = idx(player.r, player.c);
  if (boxes.has(key) || isWall(player.r, player.c)) return;
  marker = { r: player.r, c: player.c };
  render();
}

function removeMarker() {
  marker = null;
  render();
}
```

### 键盘扩展（本场景当前实现）

- 方向键 / WASD：移动
- `R`：重置关卡（立即清除标记）
- `H`：显示/隐藏提示
- `M`：切换 BGM
- `F`：切换标记（放置/移除），仅在 ice-sliding 或 slideEnabled 时有效

### 视觉设计（更新）

- 标记使用 `./assets/images/Ground_Mark.png` 作为格子背景覆盖（尺寸与地面贴图相同）。
- 若需每关自定义标记贴图，可在关卡 `config.markImage` 指定路径，渲染会优先使用该字段。

### 胜利条件

- 所有目标上都有箱子（与标准玩法一致）。

### 关卡示例

```
##############
#     .      #
#            #
#  $    @    #
#            #
#     .      #
##############
```

说明：地板为冰面，箱子推动后会滑动，需用标记阻挡以完成解法。

### 实现要点

- 在 `move()` 中检测推箱子动作，若为滑行关则调用 `slideBox()` 计算箱子最终位置。
- `placeMarker()` / `removeMarker()` 控制标记状态并触发 `render()` 更新视觉。
- `render()` 为标记位置添加 `marked` 类；样式使用 `Ground_Mark.png` 覆盖基础地面纹理。
- `resetLevel()` / `loadLevel()` 在加载时清除 `marker`，避免标记在重置后残留。

---

## UI/UX 改进

### 关卡选择界面

- 在进入 Scene4 时先显示关卡选择菜单
- 每关显示：
  - 关卡编号 + 名称
  - 关卡类型图标
  - 完成状态（未完成 / 已完成 / 最优解）
  - 最佳步数记录（如果有）

### 关卡内 UI 增强

- 顶部信息栏：
  - 当前关卡名称
  - 关卡类型提示（第 2 关显示"步数：X/Y"，第 3 关显示"颜色匹配"）
  - 返回关卡选择按钮
- 完成关卡后：
  - 显示庆祝动画 / 音效
  - 显示统计（用时、步数、是否最优解）
  - "下一关" 和 "返回选择" 按钮

### 提示系统扩展

- 每关提示内容根据关卡类型动态生成：
  - 第 1 关：标准玩法说明
  - 第 2 关：步数限制说明 + 当前步数提醒
  - 第 3 关：颜色匹配说明 + 颜色图例
  - 第 4 关：冰面机制 + 标记系统操作说明

---

## 实现优先级

### Phase 1: 多关卡框架（当前任务）

1. ✅ 关卡数据迁移到 JSON
2. ⏳ 设计 JSON 数据结构支持多关卡
3. ⏳ 实现关卡选择 UI
4. ⏳ 实现关卡切换逻辑
5. ⏳ 第 1 关完善（已有基础实现）

### Phase 2: 第二关（步数限制）

1. 实现步数计数系统
2. 实现步数 UI 显示
3. 实现步数限制逻辑
4. 设计并实现 2-3 个步数限制关卡
5. 实现失败提示与重置

### Phase 3: 第三关（颜色匹配）

1. 扩展数据结构支持颜色属性
2. 修改渲染逻辑应用颜色样式
3. 修改胜利判定增加颜色匹配检查
4. 设计并实现 2-3 个颜色匹配关卡
5. 更新提示系统

### Phase 4: 第四关（冰面滑行）

1. 实现滑行算法
2. 实现标记系统（放置/移除/渲染）
3. 扩展键盘处理（E/Q 键）
4. 设计并实现 2-3 个冰面关卡
5. 调整难度平衡

### Phase 5: 润色与优化

1. 统一视觉风格
2. 添加音效（推箱、滑行、完成、失败）
3. 添加动画过渡
4. 实现本地存储关卡进度
5. 性能优化与错误处理

---

## 技术备注

### 数据持久化

- 使用 `localStorage` 保存：
  - 已完成关卡列表
  - 每关最佳步数
  - 当前进度

### 代码组织

- 将不同关卡类型的逻辑封装为策略对象：

```javascript
const levelStrategies = {
  standard: { move, checkWin, render },
  'color-match': { move, checkWin: checkWinColorMatch, render: renderColorMatch },
  'step-limit': { move: moveWithStepCount, checkWin, render },
  'ice-sliding': { move: moveWithSlide, checkWin, render: renderWithMarker },
};
```

### 可扩展性

- 预留第 5、6 关接口（如传送门、可移动墙等机制）
- 设计通用的"特殊格子"系统（可以是冰面、传送门、单向门等）

---

## 下一步行动

当前优先级：**Phase 1 - 多关卡框架**

具体任务：

1. 更新 `scene4_sokoban.json` 为多关卡数组结构
2. 实现关卡选择 UI（简单列表或卡片式）
3. 修改 `scene4_confession.js` 支持加载指定关卡
4. 实现关卡切换与进度追踪
5. 测试第 1 关在新框架下的运行

完成 Phase 1 后再逐步实现 Phase 2、3、4。
