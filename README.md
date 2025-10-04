# 生日互动回忆小游戏

一个以你们的过去 / 现在 / 未来为主线的 H5 网页小游戏。通过 7 个场景串联情感历程：
1. 高中安抚（情绪值）
2. 高考四科小测（语数英理综）
3. 大学心动时间线（拖拽排序）
4. 表白分支互动（对话 + 彩蛋）
5. 第一次正式约会（菜单选择默契值）
6. 亲手织的围巾（点亮格子）
7. 未来愿望星空（收集愿望 -> 终章告白）

> 当前文案/题库/愿望均为占位，可根据下方说明快速替换。

---
## 快速开始
直接用浏览器打开 `index.html` 即可（推荐 Chrome / Edge / 移动端全屏）。

可将整个文件夹打包发送或部署到任意静态空间（如 GitHub Pages / Vercel / Netlify）。

---
## 目录结构
```
assets/
  images/        # 你的照片、背景、icon
  audio/         # 背景音乐、音效
css/
  styles.css     # 全局样式与场景样式
js/
  core/          # 场景管理、事件总线等基础模块
  scenes/        # 各个场景文件 scene1_intro.js ... scene7_future.js
  main.js        # 入口，注册场景
data/
  questions.json # （可扩展）题目数据示例
index.html       # 页面入口
README.md
```

---
## 自定义与替换指南
### 1. 文案与剧情
每个场景文件位于 `js/scenes/`，打开后可以看到占位文本，直接替换即可：
- 场景1：`scene1_intro.js` 中按钮文案、安抚逻辑（可增删按钮）
- 场景2：`scene2_exam.js` 内 `this.subjects` 数组可增减题目或修改校验逻辑
- 场景3：`scene3_timeline.js` 的 `this.items`，`order` 表示正确顺序
- 场景4：`scene4_confession.js` 里的台词数组（带 `class='line'` 的 `<p>`）和分支回应
- 场景5：`scene5_date.js` 的 `this.menu` 列表（`score` 用于计算默契值）
- 场景6：`scene6_scarf.js` 可调整 `rows / cols` 改网格大小
- 场景7：`scene7_future.js` 中 `this.required` 控制需要多少愿望后出现终章

### 2. 题库扩展（高考小游戏 / 场景2）
场景2 支持“外部题库替换模式”：成功加载 `data/questions.json` 时完全替换内置题；加载失败才使用代码里的默认题目。

难度权重 (可在 `scene2_exam.js` 中 `DIFFICULTY_WEIGHT` 调整)：`easy:1, medium:2, hard:3`。

计分 / 宠溺 规则（最新版）：
- 正确：`得分 = 2 * 难度权重 - (使用提示?1:0)`，最低 1 分。
- 提示：仅在“正确答题”时扣 1 分；跳过与错误宠溺不受影响。
- 宠溺跳过（“不会但我超可爱”）：`得分 = 2 * 难度权重`（不减不罚）。
- 错误宠溺通过：答错也判定通过并给“完整得分” `2 * 难度权重`，且显示正确答案，不受提示影响。

题目对象的额外标记：
- `_skipped`：本题通过宠溺跳过。
- `_pamperedWrong`：本题通过“答错被宠”方式获得满分。

彩蛋优先级（互斥显示）：
1. 全部题都跳过 → “罚你亲我” 彩蛋。
2. 全部题都靠错误宠溺通过 → “终身保护” 彩蛋。
3. 跳过率 ≥ 50%（且非前两种） → “示弱撒娇” 彩蛋。

外部题库示例结构：
```jsonc
{
  "chinesePoemFill": [
    { "question": "山有木兮木有枝，_____", "answer": "心悦君兮君不知", "encourageCorrect": "诗意满分！", "encourageWrong": "再想想那句古风情话~" }
  ],
  "mathPuzzles": [
    { "question": "(5 + 1) × 2 - 3 = ?", "answer": "9", "encourageCorrect": "脑力很清醒！", "encourageWrong": "括号顺序再过一遍~" }
  ],
  "englishMatch": [
    { "word": "forever", "match": "永远", "encourageCorrect": "Forever = 永远爱你", "encourageWrong": "我们常说的那个‘永**’" }
  ],
  "scienceQuiz": [
    { "question": "彩虹形成主要和什么光学现象有关？", "options": ["折射","衍射","干涉"], "answer": 0, "encourageCorrect": "彩虹为你弯下腰~", "encourageWrong": "想想光进水再出来会怎样~" }
  ]
}
```
字段说明：
- `chinesePoemFill[]`：`question` 可含 `_____` 占位（渲染时自动分离），`answer` 为完整填充。
- `mathPuzzles[]`：`answer` 取第一个空格前作为校验主值。
- `englishMatch[]`：`word` 英文，`match` 中文。
- `scienceQuiz[]`：`options` 选项数组，`answer` 正确索引（数字）。
- 每条可提供自定义鼓励：`encourageCorrect` / `encourageWrong`。

想收紧难度或降低宠溺：
1. 在错误分支把 `2 * weight` 改回自定义低分。
2. 加一个“认真模式”开关（条件判断包裹跳过/错误逻辑）。

想给“正确”也展示解析：在正确分支追加一个 `<div class='explain'>解析...</div>` 即可。

### 3. 加入背景音乐
1. 放一首 mp3 到 `assets/audio/bgm.mp3`（命名可自定）。
2. 在 `index.html` `<body>` 内添加：
```html
<audio id="bgm" src="./assets/audio/bgm.mp3" loop></audio>
```
3. 在 `js/main.js` DOMContentLoaded 后：
```js
const bgm = document.getElementById('bgm');
// 用户手动触发播放（iOS 限制自动播放）
window.addEventListener('click', ()=> { if(bgm.paused) bgm.play(); }, { once:true });
```
4. 添加静音按钮：
```html
<button id="muteBtn" style="position:fixed;top:10px;left:10px;z-index:50;">🔊</button>
```
```js
const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', ()=>{
  if(bgm.muted){ bgm.muted=false; muteBtn.textContent='🔊'; } else { bgm.muted=true; muteBtn.textContent='🔈'; }
});
```

### 4. 添加全屏
```js
function toggleFull(){
  if(!document.fullscreenElement){ document.documentElement.requestFullscreen(); }
  else{ document.exitFullscreen(); }
}
```
可在页面放一个按钮触发。

### 5. 更换配色 / 主题
编辑 `css/styles.css` 中 `body` 的背景渐变与按钮颜色。可新建一个 `:root` 变量区：
```css
:root {
  --c-accent: #ff6f90;
  --c-accent-soft: #ffa9c0;
  --c-bg-grad-1: #FFE7D9;
  --c-bg-grad-2: #FFC9B9;
  --c-bg-grad-3: #FFB6C1;
}
```
然后使用 `var(--c-accent)` 统一管理。

### 6. 增加一个新场景
1. 新建文件：`js/scenes/sceneX_new.js`
```js
import { BaseScene } from '../core/baseScene.js';
export class SceneXNew extends BaseScene {
  async enter(){
    const el = document.createElement('div');
    el.className='scene scene-new';
    el.innerHTML = `<h1>新场景</h1><p>自定义内容...</p>`;
    this.ctx.rootEl.appendChild(el);
  }
}
```
2. 在 `main.js` 顶部 import：
```js
import { SceneXNew } from './scenes/sceneX_new.js';
```
3. 注册：
```js
sceneManager.register('newScene', ()=> new SceneXNew(context()));
```
4. 在前一个场景里调用：`this.ctx.go('newScene');`

### 7. 彩蛋示例（可扩展）
- 连续 3 次错误答案：显示一段鼓励话语。
- 围巾场景 10 秒内点亮 40+ 格：出现隐藏提示。
- 愿望输入含有特定关键词（如昵称）：生成特别颜色的星星。
- 表白场景暗藏一个透明按钮（已实现原型：右上角星星）。

示例：在愿望场景加入关键词彩蛋：
```js
if(/昵称|特殊词/.test(text)){
  star.classList.add('special');
  star.style.background = 'radial-gradient(circle,#fff6b0,#ffcf40)';
}
```
并在 CSS：
```css
.star.special { box-shadow:0 0 10px 4px rgba(255,230,120,.9); }
```

#### 已实现（场景2）彩蛋回顾
| 彩蛋 | 触发条件 | 文案方向 |
|------|----------|----------|
| 全跳过 | 所有题 `_skipped` | 亲亲 + 调侃 |
| 全部错误宠溺 | 所有题 `_pamperedWrong` | 终身保护宣誓 |
| 半数以上跳过 | 跳过率 ≥ 50% 且非上面两个 | 撒娇被宠 |

优先级：全跳过 > 全错误宠溺 > 半数跳过。

### 8. 打包部署
- GitHub Pages：仓库 settings -> Pages 选择分支 root。
- Vercel / Netlify：直接导入仓库一键部署。
- 本地打包：压缩整个目录发送即可。

### 9. 性能/兼容小建议
- 图片使用适当压缩（WebP / AVIF）。
- 不必要的动画加 `will-change` 可能反而耗电，保持轻量。
- 移动端按钮区域增大：`padding` 不低于 `0.6rem`。

### 10. 安全与隐私
如含真实照片或隐私内容，避免公开部署或加简单访问口令（可用最简密码输入后才开始 `go('intro')`）。

---
## 素材占位待替换清单
请准备：
- 表白原话（替换场景4特殊行）
- 高中安抚按钮更真实语气
- 高考题库真实定制
- 时间线 3~5 条真实事件
- 菜单菜品 & 评分偏好
- 围巾颜色描述 + 是否需要心形图案
- 未来愿望 5~8 条
- 彩蛋关键词 / 内部梗

---
## TODO 规划（后续可加）
- 资源预加载与进度条 overlay
- 音效（点击 / 正确 / 完成）
- 成就面板（统计你点了多少搞怪选项）
- 数据分离（所有文本改 JSON + 多语言）
 - 认真模式开关（禁止跳过/错误满分）
 - 题目答题统计图表/成就徽章
 - 统一 easter eggs registry（集中配置触发条件）

---
_最近更新：加入错误满分宠溺、答案展示、全错误宠溺彩蛋与彩蛋优先级说明。_

---
## License
个人情感礼物项目，默认不做公开商业授权；如需分享请去掉隐私素材。

祝：制作顺利，表白永远有效。❤️
