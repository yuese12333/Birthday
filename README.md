<div align="center">

# 生日互动回忆小游戏

一次把「过去 → 当下 → 未来」浓缩成互动旅程的 H5 礼物。

| 场景编号 | 标题关键词 | 玩法核心 | 状态 |
|----------|------------|----------|------|
| 0 | 注册仪式 | 纪念日密码 + 线索渐进 | 已基本实现 ✅ |
| 1 | 高中安抚 / 穿越自证 | 纯分支对话（dialogue_x_y + win/fail） | 正在实现 ✅ |
| 2 | 高考小游戏 | 顺序四科 + 独立计时 + 宠溺得分 + 三段提示 + 题型/难度外部化 | 正在实现 ✅ |
| 3 | 大学时间线（占位） | 玩法待设计（当前仅跳转按钮） | 占位 ✅ |
| 4 | 表白（占位） | 玩法待设计（当前跳转占位） | 占位 ✅ |
| 5 | 约会卡牌 | 多关卡卡牌组合 + 外部化协同规则 | 已初步实现 ✅ |
| 6 | 织围巾（占位） | 玩法待设计（当前仅跳转按钮） | 占位 ✅ |
| 7 | 未来愿望（占位） | 玩法待设计（当前直接祝福） | 占位 ✅ |
| 8 | 终章（占位） | 最终祝福 / 统计汇总预留 | 占位 ✅ |

</div>

> 全部纯原生 HTML / CSS / JS，无构建依赖，直接双击 `index.html` 即可体验。

---
## 🔧 快速开始
1. 下载或克隆项目。
2. 用浏览器打开根目录下 `index.html`。
3. 若放到 GitHub Pages / Vercel / Netlify：直接部署静态资源，无需服务器。
---
## 📁 目录结构
```
assets/
  images/            # 图片（自备真实照片可更有代入感）
  audio/             # 计划中的 BGM / SFX
css/                 # 全局 + 场景样式（集中在 styles.css）
js/
  core/              # BaseScene / SceneManager / EventBus 等基类
  scenes/            # 场景 0~7 源文件
  main.js            # 入口（注册场景 & 全局防抖 & 快捷键）
data/
  questions.json     # 外部题库
  scene1_script.json # 场景 1 分支脚本
index.html
README.md
```

---
## 🧭 场景总览（按体验顺序）

### 0. 注册仪式（Scene0Register）
**当前实现**
- 输入任意“用户名” + 纪念日密码（`20241007`）。
- 背景音乐（BGM）自动播放，使用正确的 key '0' 管理，确保静音/停止逻辑无误。
- 若自动播放失败，3秒后页面顶部会弹出“点我播放音乐”按钮，用户可手动解锁音频。
- 点击“我忘了”按钮会出现1~4个生气表情，第5次出现哭脸表情并禁用按钮。
- 输入错误会依次显示生气提示，第5次出现哭脸，第6次自动退出网页。
- 每次密码错误或点击“我忘了”按钮，都会禁用音乐（静音并置灰按钮），且无法恢复。
- 错误与表情提示采用统一结构，支持动画效果。
- 全局点击防抖：提交、忘记按钮均带 `data-debounce`。
- debug 面板可一键跳转任意场景，方便开发调试。

**未来预期**
- Serious 模式：关闭忘记按钮或延迟可用。
- 成就：不看任何线索一次通过授予徽章。
- 主题可配置：不同纪念日切换背景 / 标题文案。

**debug**
- 可以通过 debug 面板进入任意场景。

### 1. 高中安抚 / 穿越自证（Scene1Intro）
**当前实现（统一命名 + 失败推进）**
- 外部脚本驱动：`data/scene1_script.json`。
- 阶段命名强制：`dialogue_<failCount>_<seq>`；入口固定 `dialogue_0_1`。
- 分支支持特殊 goto：`win` / `fail`。
  - `win`：显示成功 overlay → 过渡到下一正式场景（当前为 `exam`）。
  - `fail`：显示失败 overlay → 自动跳转 `dialogue_{当前failCount+1}_1`（必须存在；未找到仅控制台警告）。
- 去除旧 fallback：假设脚本必然成功加载且结构正确。
- 无隐藏数值：只保留“逐行播放 → 分支选择 → 跳阶段 / 触发 win/fail”。
- 打字机：空格 / 点击空白提前补全或推进下一行。
- 说话人徽标：`me` 左、`her` 右人物、`system` 右系统色。
- 彩蛋：标题多次点击触发提示与一次性隐藏文案。
- 移动端：pointerup + touchend 兜底防丢点击。
- 打字机音效：每两个有效字符（中英文数字）播放一声，降低噪点。

**脚本字段仍精简**
- Stage: `{ id, lines:[{speaker,text}], choices:[{text,goto}], end:{next} }`
- 忽略并不报错：`trustDelta` / `moodDelta` / `requireTrust` / `requireMood` / `auto` 等历史字段。

**扩展预留（尚未实现）**
- tagsAdd：为后续场景准备上下文标签。
- 行级 typingSpeed：个别台词节奏。
- 条件过滤：requireTags / excludeTags。
- 路径统计：用于终章个性化总结。

### 剧情梗概
（占位：此处不写具体剧情内容，保持私密性）

### 2. 高考小游戏（Scene2Exam）
**当前实现（最新）**
1. BGM：进入自动尝试淡入播放（失败可点音符解锁），离场淡出；使用场景 key `2` 管理。
2. 科目顺序：语文 → 数学 → 英语 → 理综，需依次完成（已完成科可回看但不再计时）。
3. 单科 5 分钟倒计时：进入科目启动；完成或超时后停止；与下一科之间若 30 秒未开始出现“懒散提醒”彩蛋行。
4. 外部题库：强制依赖 `data/questions.json`；加载成功后完全覆盖（无 fallback 题库）。
5. 题目结构外部可配置 `questionType`（渲染/交互方式）与 `difficulty`（easy|medium|hard）。
6. 难度权重：easy=1 / medium=2 / hard=3；统一得分公式：`gained = 2 * weight`。
7. 宠溺模式：正确 / 错误（被宠）/ 跳过 / 第三次提示 均给予完整得分（并标记不同来源统计）。
8. 提示三段：第 1、2 次依次累积显示 hints；第 3 次直接自动判定正确并揭示答案、加分、锁题。
9. 题型注册表：`QUESTION_TYPE_REGISTRY` 统一渲染输入控件；`extractUserAnswer()` + `isAnswerCorrect()` 统一答案采集与判定，新增题型只需在注册表 + 判定/抽取函数中补分支。
10. 彩蛋互斥优先级：全跳过 > 全自动提示通过 > 全错误宠溺（使用 GIF 图块）。
11. 汇总面板：总题数 / 得分 / 动态评价 / 彩蛋展示。

**未来预期**
- Serious 模式：跳过 0 分 / 错误 0 分或扣分 / 第三次提示仅揭示答案不加分。
- 成就体系：全对 / 无提示 / 仅一次提示 / 全跳过 / 全错被宠 / 全第三次提示。
- 统计可视化：题型分布、得分来源堆叠、提示使用率雷达。
- 新题型：multiSelect / dragMatch / order / audio / image-hotspot（均通过注册表扩展）。
- 与前后场景联动：根据跳过/错误率影响后续台词情感细节。 

### 3. 大学时间线（Scene3Timeline）
## 当前实现 ##
当前为占位：玩法尚未设计。页面仅展示提示文本与“进入下一幕”按钮，方便串联整体体验。

## 未来计划（草案）##
- 拖拽 / 触摸交换排序大学关键事件（事件外部 JSON 化）。
- 部分错位容错评分（接近正确给暖心文案）。
- 事件 Hover / 点击展示照片 / 备注弹层。
- 完成度统计写入终章个性化文案（记忆准确率）。
- 彩蛋：全部放错 / 一次性全对 / 特定事件组合。

### 4. 表白（Scene4Confession）
当前为占位：原计划“多段逐行表白 + 分支回应”玩法尚未设计完成。页面仅显示占位说明、BGM 按钮与“进入下一幕”按钮（带转场 flash45）。

未来计划（草案）：
- 多段真实表白台词逐步解锁（打字机 + 心跳 / 呼吸动效）。
- 分支回应类型（羞涩 / 追问 / 接受）→ 影响后续彩蛋或成就标签。
- 隐藏触发词：输入特定暗号解锁额外深情段落。
- 心率/紧张度模拟：随着台词推进视觉/音效细微变化。
- 统计：记录首次点击“接受”所处文本阶段。

### 5. 第一次约会（Scene5Date）
**当前实现（外部数据驱动 - 初版）**
- 外部 JSON：`data/date_levels.json` 定义 `levels[]`，每关自带 `cards` / `pick:[min,max]` / `targetTags` / `synergyRules`。
- 完全每关独立卡池：不再共用全局卡牌，方便做“主题差异化”关卡。
- 协同评分引擎（rule engine）：当前内置两类
  - `set`：指定 `ids` 全被选中触发（固定组合）
  - `tagCombo`：标签组合（`all=true` 需全部包含；否则任一命中即可）
- 评分拆分：基础分 (base) + 目标标签匹配数 (targetBonus) + 协同加成 (synergyBonus)。
- 漂浮提示：每条协同命中即时弹出一次性气泡。
- 结算后锁卡：防止提交后再改动导致分数漂移。
- 最终总结：动态估算“理论最大值”（粗略：topN 基础分 + 所有目标标签数 + 所有规则 bonus 总和）并给出评价。
- BGM 使用统一场景 key `5`，支持静音切换。
- JSON 加载失败 fallback：提供最小占位一关不阻断流程。

**外部关卡 JSON 示例（节选）**
```jsonc
{
  "meta": { "version": 1 },
  "levels": [
    {
      "id": 1,
      "title": "第一关 · 轻松破冰",
      "tip": "想要：轻松 + 温柔",
      "pick": [2,3],
      "targetTags": ["light", "soft"],
      "cards": [
        { "id":"show_soft", "title":"话剧 · 治愈系对白", "base":2, "tags":["soft","healing","show"], "hint":"温柔对白" },
        { "id":"drink_orange", "title":"饮品 · 橙子气泡", "base":1, "tags":["fresh","light","drink"], "hint":"清爽提神" },
        { "id":"food_dessert", "title":"餐点 · 心形慕斯", "base":3, "tags":["sweet","romance","food"], "hint":"仪式甜感" }
      ],
      "synergyRules": [
        { "type":"set", "ids":["show_soft","food_dessert"], "bonus":2, "label":"柔甜共鸣" },
        { "type":"tagCombo", "tags":["sweet","romance"], "all": false, "bonus":1, "label":"甜意触发" }
      ]
    }
  ]
}
```

**未来扩展方向**
- 更多规则类型：`ratio`（某类标签占比≥阈值）、`sequence`（按展示顺序挑选）、`avoidConflict`（同时出现减分 / 触发替换）、`pairPrefer`（成对出现加倍）。
- 分档评价表：外部提供 scoreRatio → 文案映射取代硬编码 if/else。
- 稀有度 / 花费系统：增加 `cost` 字段与关卡“预算”上限，鼓励策略选牌。
- 推荐提示：结算时展示“少选/错过这些即可 +X 分”。
- 成就：全关命中全部目标标签；首次尝试即 ≥90%；任意关卡 0 协同但高分（“逆风翻盘”）。
- 组合回放：终章引用最高协同关卡组合描述个性化文案。

> 当前实现目标聚焦“外部化 + 引擎基础”；复杂视觉（连接线/发光）与策略资源机制尚未加入。

### 6. 织围巾（Scene6Scarf）
当前为占位：最终计划是“拖动/连续点亮像素格”模拟织围巾过程；本阶段暂未实现核心玩法，仅保留说明与继续按钮保证流程连贯。

未来计划（草案）：
- 像素模板（心形 / 纪念日数字）完成度判定。
- 进度驱动渐变配色与线条呼吸动画。
- 拖动轨迹粒子 / 纱线生成动画。
- 成就：一次性无回头全覆盖、最短时间完成、最长连续拖动。
- 震动反馈：关键节点（25% / 50% / 100%）轻微震动。

### 7. 未来愿望星空（Scene7Future）
### 8. 终章（Scene8Final）
当前为占位：展示简单祝福文本与“重新开始”按钮。未来将：
- 汇总：答题表现 / 约会协同最好组合 / 成就标签 / 互动彩蛋。
- 个性化文案模板：通过占位符插入统计（如：你共解锁 X 条提示 / 达成 Y 次协同）。
- 图片拼贴：可选多张旅程照片生成拼贴或导出纪念图。
- 成就展示：勋章 / 百分比 / 彩字动画。
- 再次旅程分支：选择“仅未来章节”或“完整回放”。

> 终章与愿望场景之间可插入转场动画（flash12 / 自定义 memory）。
当前为占位：未来计划是“输入愿望 → 星星随机落点 → 达到阈值触发终章祝福”。目前版本为保证旅程闭环，仅保留占位说明与“进入最终祝福”按钮，点击后展示简化祝福文案。

未来计划（草案）：
- 星星标签分类（旅行 / 成长 / 仪式 / 情感）不同色彩与轻微闪烁频率。
- 单星点击回显 & 编辑 / 标记完成。
- 统计引用：结合 Scene2 答题统计 + Scene5 协同最高组合生成个性化总结段落。
- 愿望热度：根据输入关键词（旅行/看海/电影）触发不同特效（波纹 / 流星 / 光晕）。
- 保存与回放：localStorage 持久化愿望列表（首次与后续追加区分展示）。

---
## 📌 外部题库结构（场景2）
当前版本题库完全外部化，可直接编辑 `data/questions.json` 热替换（刷新后生效）。

### 最小可运行示例（含题型/难度/多提示）
```jsonc
{
  "chinesePoemFill": [
    { "questionType": "fill", "difficulty": "easy", "question": "山有木兮木有枝，_____", "answer": "心悦君兮君不知", "hints": ["出自《越人歌"], "encourageCorrect": "诗意满分！", "encourageWrong": "再想想那句古风情话~" }
  ],
  "mathPuzzles": [
    { "questionType": "fill", "difficulty": "medium", "question": "(5 + 1) × 2 - 3 = ?", "answer": "9", "hints": ["先算括号","再乘 2"], "encourageCorrect": "脑力很清醒！", "encourageWrong": "括号顺序再过一遍~" }
  ],
  "englishMatch": [
    { "questionType": "fill", "difficulty": "easy", "word": "forever", "match": "永远", "hints": ["for + ever"], "encourageCorrect": "Forever = 永远爱你", "encourageWrong": "我们常说的那个‘永**’" }
  ],
  "scienceQuiz": [
    { "questionType": "select", "difficulty": "easy", "question": "彩虹形成主要和什么光学现象有关？", "options": ["折射","衍射","干涉"], "answer": 0, "hints": ["光进水又出"], "encourageCorrect": "彩虹为你弯下腰~", "encourageWrong": "想想光进水再出来会怎样~" }
  ]
}
```

### 字段说明（按题目类型分类）
通用：
- `questionType`：题型标识（当前内置：`fill` | `select`；可扩展）。旧字段 `type` 仍被兼容读取。
- `difficulty`：`easy` | `medium` | `hard`，缺省回退不同科目默认（语/英 easy，数/理 medium）。
- `hints`：数组；前两条按次数累积显示；第 3 次提示自动给答案。
- `encourageCorrect` / `encourageWrong`：答题反馈文案。

填空 / 配对类（`fill`）：
- `question`：题干（可含占位“_____”）。
- `answer`：字符串正确答案。
- `placeholder`：可选；未提供使用内部默认。

英语匹配（以 fill 方式渲染）：
- `word` + `match`（内部转换为 prompt + answer）。

选择题（`select`）：
- `options`：字符串数组。
- `answer`：正确选项索引（数字）。

### 运行时内部转换
加载时会生成统一内部结构：`{ type, difficulty, prompt, answer/answerIndex, options?, hints, solved, correctMsg, wrongMsg }`。
为兼容老数据：
- 若不存在 `questionType` 则尝试 `type` → 再回退科目默认（语/数/英=fill，理综=select）。
- 缺失 `difficulty` 按科目回退：语文/英语→easy；数学/理综→medium。

### 题型扩展示例
新增多选题（`multiSelect`）需：
1. 在 `scene2_exam.js` 的 `QUESTION_TYPE_REGISTRY` 内添加：
```js
multiSelect: q => q.options.map((o,i)=>`<label><input type='checkbox' value='${i}'/>${o}</label>`).join('')
```
2. 在 `extractUserAnswer()` 中添加分支：
```js
case 'multiSelect': return [...wrapper.querySelectorAll("input[type=checkbox]:checked")].map(n=>parseInt(n.value,10));
```
3. 在 `isAnswerCorrect()` 中添加比较逻辑（例如比对排序后的数组）。
4. 在外部 JSON 中为对应题目写入：
```jsonc
{ "questionType":"multiSelect", "difficulty":"hard", "question":"以下哪些属于…?", "options":["A","B","C"], "answer":[0,2] }
```

> 其余高级题型（拖拽、排序、音频听写）同理：注册渲染 → 追加答案采集 → 追加判定。

---
## ❤️ 宠溺/得分与提示规则速览
- 满分公式：`score = 2 * DIFFICULTY_WEIGHT[difficulty]`。
- 统一加分来源：正确 / 错误被宠 / 跳过 / 第三次提示自动完成 → 都走同一公式（区分来源做标记）。
- 提示：前两次显示 `hints[0]`、`hints[1]`（缺失安全回退）；第 3 次自动揭示答案并锁题。
- 彩蛋优先级：全跳过 > 全第三次提示 > 全错误宠溺（互斥）。
- Serious 模式预留：将改写错误/跳过/第三次提示得分逻辑（未实现）。

---
## 📜 Scene1 分支脚本 JSON Schema (`data/scene1_script.json`)
（2025/统一命名 + win/fail 版本）

### 最小示例（dialogue_x_y + win/fail）
```jsonc
{
  "meta": { "version": 3, "desc": "Scene1 branching script (dialogue_x_y)" },
  "stages": [
    { "id": "dialogue_0_1", "lines": [
        { "speaker": "me", "text": "为了给你准备一个最特别的生日礼物，我竟然……时空裂开了！" },
        { "speaker": "her", "text": "……你是谁？" }
      ],
      "choices": [
        { "text": "说出专属记忆细节", "goto": "dialogue_0_2" },
        { "text": "随口糊弄（翻车）", "goto": "fail" }
      ]
    },
    { "id": "dialogue_0_2", "lines": [ { "speaker": "her", "text": "……这些细节，确实只有他才知道。" } ],
      "choices": [ { "text": "继续安抚", "goto": "dialogue_0_3" } ] },
    { "id": "dialogue_0_3", "lines": [ { "speaker": "system", "text": "她的防备似乎在慢慢下降…" } ],
      "choices": [ { "text": "进入下一幕", "goto": "win" } ] },
    { "id": "dialogue_1_1", "lines": [ { "speaker": "her", "text": "你刚才那些说辞…完全站不住脚。" } ],
      "choices": [
        { "text": "这次认真讲述过去", "goto": "dialogue_1_2" },
        { "text": "继续嘴硬（再次失败）", "goto": "fail" }
      ] },
    { "id": "dialogue_1_2", "lines": [ { "speaker": "me", "text": "我记得你那次晚自习忘带水杯…" } ],
      "choices": [ { "text": "她情绪缓和了", "goto": "dialogue_1_3" } ] },
    { "id": "dialogue_1_3", "lines": [ { "speaker": "system", "text": "或许这次终于成功说服她…" } ],
      "choices": [ { "text": "进入下一幕", "goto": "win" } ] }
  ]
}
```

### 字段定义
| 层级 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 根 | meta | object? | 元信息（可忽略）。|
| 根 | stages | Stage[] | 阶段数组；引用自由，不要求顺序排列。|
| Stage | id | string | 必须匹配 `dialogue_<failCount>_<seq>`。|
| Stage | lines | Line[] | 进入阶段后按顺序逐句播放。|
| Stage | choices | Choice[]? | 所有台词播完后显示的分支按钮。|
| Stage | end | { next: string }? | 阶段结束后触发转场：`next` 为目标场景 ID（例：`exam`）。|

#### Line
| 字段 | 说明 |
|------|------|
| speaker | `me` | `her` | `system`。|
| text | 台词文本（支持 `\n`）。|

#### Choice
| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 按钮文案。|
| tagsAdd | string[]? | 预留：添加标签。|
| goto | string? | 下一阶段 ID；或特殊：`win` / `fail`。|

#### End
| 字段 | 类型 | 说明 |
|------|------|------|
| next | string | 跳往的下一场景（非阶段）。|

### 行为流程（dialogue_x_y 版本）
1. 起点：`dialogue_0_1`。
2. 播放 `lines`（空格 / 点击空白推进；打字中再次触发补全）。
3. 播放完：若存在 `end` → 转场；否则渲染 `choices`。
4. 普通 `goto`：直接跳 `dialogue_*_*`。
5. `goto: fail`：失败 overlay → 跳 `dialogue_{当前failCount+1}_1`。
6. `goto: win`：成功 overlay → 转场到下一场景（`exam`）。

### 失败链与容错
- 不再提供脚本加载失败 fallback；脚本必须完整。
- 所有 fail 目标阶段 `dialogue_{n+1}_1` 必须显式存在。
- 缺失目标：仅控制台警告（开发期暴露配置问题）。

### 可扩展建议（尚未内置）
- requireTags / excludeTags：基于标签做分支锁定。
- 行级 typingSpeed：节奏微调。
- 分支路径记录：终章个性化统计引用。
- 更复杂失败树：允许 `fail` 携带参数决定不同后续（未来可拓展 `fail:x` 语法）。

> 历史数值驱动字段已移除；残留将被静默忽略。

---
## 🛡️ 全局机制
| 机制 | 描述 |
|------|------|
| 场景管理 | `SceneManager` 控制生命周期 enter/exit，防并发切换锁。|
| 转场场景 (NEW) | `TransitionScene` 手动调用过渡：支持 `flash12`（原 heart） / `flash45`（闪回图片序列 + 独立一次性音效），默认关闭自动插入；显式 `this.ctx.go('transition', {...})`。|
| 事件总线 | `EventBus`（当前轻量，预留解耦扩展）。|
| 全局防抖 | 任意元素加 `data-debounce` 即可，捕获阶段阻断重复点击。|
| 本地持久 | （已精简：注册标记机制移除，当前无全局持久状态）|
| 外部题库 | 自动 fetch `data/questions.json` 覆盖内置。|
| 彩蛋系统 | 目前分散（场景1 标题点击 / 场景2 结果统计），后续计划集中注册。|
| 移动端适配 | 时间线触摸点选交换 / 围巾拖动连续涂抹 / 按钮命中区域放大 | ✔ 已完成首轮 |

---
## 📱 移动端适配说明
近期完成：
- 时间线：触摸端自动启用“点选两项交换”模式（无原生拖拽兼容问题）。
- 围巾：指针按下进入绘制模式，滑动连续点亮；指针抬起/取消即结束。
- 样式：触摸环境放大按钮与卡牌内边距；围巾格子尺寸放大；禁用绘制区域滚动。
- 检测：使用 `(pointer:coarse)` 作为触摸环境判定，不影响桌面逻辑。

待改进：
- pointermove 高频：可做节流（每 ~8ms 合并）。
- 触觉反馈：调用 `navigator.vibrate`（需用户手势授权）。
- 橫屏布局微调：围巾栅格自适应换行。

---
## 🧩 自定义常用入口
- 修改题库：放置 / 编辑 `data/questions.json`。
- 修改高中场景对话脚本：`data/scene1_script.json`（信任阶段/解锁后台词外部化，可追加阶段）。
- 增减时间线事件：`scene3_timeline.js` 的 `this.items`。
- 增加表白台词：`scene4_confession.js` 中对话数组。
- 约会关卡：编辑 `data/date_levels.json`（卡牌 / 关卡 / 协同）。
- 围巾尺寸：`scene6_scarf.js` 中网格行列参数。
- 愿望阈值：`scene7_future.js` 中 `this.required`。
- 转场动画：`scene_transition.js` 可扩展 `style` 分支（已含 `flash12` / `flash45`，可自行新增 `petal` 等）。

TODO（后续将逐步用转场包装的跳转示例）：
```
intro -> exam        ✅ 已接入
exam -> timeline     ⏳ 待接入
timeline -> confession ⏳ 待接入
confession -> date   ✅ 已接入
date -> scarf        ⏳ 待接入
scarf -> future      ⏳ 待接入
```

---
## 🎬 转场系统 (Transitions & SFX)
手动在任一场景调用：
```js
this.ctx.go('transition', {
  next: 'date',              // 进入的下一个场景 ID
  style: 'flash45',          // flash12 | flash45 | (自定义 petal / memory ...)
  images: ['.../mem_4_1.jpg','.../mem_4_2.jpg'], // 仅 flash45 需要
  duration: 4000,            // ms；显式提供时不会被内部重算覆盖
  sound: './assets/audio/scene_45.wav', // 一次性音效（优先级最高）
  tip: '那些瞬间像流光一样掠过…',
  useBGM: false              // true 则忽略一次性音效，使用过渡 BGM
});
```

### 时长优先级
| 条件 | 使用规则 |
|------|----------|
| 传入 duration | 直接使用，不再按帧数改写 |
| 未传 & flash45 | 帧数 * 260ms ，钳制 1800~4500ms |
| 未传 & flash12 | 使用默认构造时长 (3000ms) |

### 音效优先级
1. 显式 `sound`
2. 自动命名（新增）：`./assets/audio/scene_<from><to>.{mp3,wav,ogg}` 例如从 1→2 尝试 `scene_12.mp3`；来源和目标通过场景 id 映射数字（`register=0,intro=1,exam=2,timeline=3,confession=4,date=5,scarf=6,future=7`）。
3. 自动命名：`./assets/audio/transition_<style>.{wav,mp3,ogg}`
4. （flash45 回退）`./assets/audio/scene_45.wav`
5. `useBGM:true` → 跳过 1~4，播放一次性过渡 BGM（非循环）
6. 仍无：flash45 静默，其它 style 播放默认 BGM

> 建议一次性音效长度 0.4s~2s，首帧无静音。

### 常见示例
| 需求 | 调用参数 | 说明 |
|------|----------|------|
| 固定 4 秒照片闪回 | `style:'flash45', duration:4000, images:[...], sound:'scene_45.wav'` | 不随图片数变化 |
| 基础心跳过渡 | `style:'flash12'` | 默认 3s + 粒子 |
| 只换 BGM | `style:'flash12', useBGM:true` | 不放一次性音效 |
| 静默黑场 | `style:'flash12', duration:1200, sound:undefined` + 自定义 CSS 隐藏元素 | 需要自定样式 |

### 自定义新 style（示例 petal）
1. 在 `scene_transition.js` : `if(style==='petal'){ ... }` 生成花瓣 DOM。
2. 在 `styles.css` 增加 `[data-style='petal']` 样式与 `@keyframes petalFall`。
3. 放置 `assets/audio/transition_petal.wav`（可省略）。
4. 调用 `this.ctx.go('transition',{ next:'future', style:'petal', tip:'花瓣慢慢落下…' });`

### 预加载建议
```js
['mem_4_1.jpg','mem_4_2.jpg'].forEach(n=>{ const img=new Image(); img.src='./assets/images/'+n; });
```
在用户任意首次点击后预热音频上下文以避免自动播放阻止。

### 音频命名规范（新增约定）
为统一管理与快速定位，建议后续将音频文件按以下规则命名：

| 类型 | 命名模式 | 示例 | 说明 |
|------|----------|------|------|
| 场景 BGM | `scene_<x>.mp3` | `scene_1.mp3`, `scene_5.mp3` | 每个主要场景一个主 BGM（使用 mp3；若需无损可并行放 wav）。|
| 转场一次性音效 | `scene_<from><to>.(mp3/wav/ogg)` | `scene_12.mp3`, `scene_45.wav` | 表示从场景 `<from>` 跳到 `<to>` 的独特过渡（数字拼接，不加下划线）。|


命名解读：
- 进入场景 5：系统可根据你显式调用 `audioManager.playSceneBGM('scene5')` 或自定义逻辑播放 `assets/audio/scene_5.mp3`。
- 从 1 → 2 的转场：可在调用时指定 `sound:'./assets/audio/scene_12.mp3'`。
- 从 4 → 5 若遵循既有案例：`scene_45.wav` 已被使用；也可换 mp3 保持统一。

推荐实践：
1. 新增转场时优先放置 `scene_<from><to>.mp3`；调用时直接显式 `sound`，避免靠风格推断。
2. 若某转场需要多变体（例如不同分支音效），可扩展后缀：`scene_12_alt1.mp3`，并在代码中显式引用。
3. 若想完全弃用 `transition_<style>` 方案，可在 README 旧位置标注“已废弃”，但目前保留兼容无需修改代码。
4. 使用 wav 仅限短促（<2s）需要高瞬态清晰度的音效；一般统一 mp3 足够。

（当前代码：显式 `sound` > `scene_<from><to>` 自动推断 > `transition_<style>` 自动推断 > flash45 特例 > BGM/静默。你仍可显式传 `sound` 覆盖所有自动推断。）

---
## 🪄 未来路线（Roadmap）
| 类别 | 计划 | 状态 |
|------|------|------|
| 模式 | Serious 模式（收紧容错） | 待设计 |
| 成就 | 全对 / 无提示 / 零跳过 / 彩蛋收集 | 待实现 |
| 统计 | 组合最高值 / 错误来源分析 | 待实现 |
| 音频 | BGM + 微动效音效 | 待添加 |
| 转场 | flash12 / flash45 / （规划：petal / memory fade / star tunnel） | 进行中 (flash12 + flash45) |
| 彩蛋 | 统一 registry + 条件 DSL | 规划中 |
| 个性化 | 终章引用前面统计（例如你“××题都跳过”） | 规划中 |
| UI | 主题切换（粉 / 暖白 / 星空） | 规划中 |
| 国际化 | 全文案 JSON 化 + 多语言 | 规划中 |
| 移动端 | 时间线触摸交换 + 围巾拖涂 + 基础尺寸优化 | 已完成 ✅ |

---
## 📝 素材准备清单
- 高中安抚真实语气 5~8 句
- 高考题库（可按你们的梗定制）
- 大学事件 4~6 条（带年份 / 月份）
- 表白真情台词分支（甜 / 搞怪 / 深情）
- 约会菜单（菜品 + 共同回忆标签）
- 围巾是否要心形、首字母或日期彩蛋
- 未来愿望 6~10 条（旅行 / 成长 / 生活 / 仪式）
- 私人彩蛋关键词（昵称 / 暗号）

---
## 🚀 部署
- GitHub Pages：Settings → Pages → 选 main 分支 root。
- Vercel / Netlify：直接导入仓库 → 部署。
- 本地打包：压缩整个目录发送即可离线打开。

---
## 🔐 隐私 & 安全
若包含真实照片 / 聊天记录，避免公开仓库；或改用临时受限分享链接。

---
## License
私人情感礼物项目（非商业）。如需二次传播请先移除私人素材。

> 祝：故事继续被认真书写，愿望都按计划一个个兑现。❤️


## 未使用构思：
- 数织游戏
     