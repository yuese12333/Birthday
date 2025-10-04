# 素材填写清单 (请按需补充)

将真实内容填入后，我可以帮你批量替换代码里的占位。

## 1. 高中安抚场景（Scene1）
情绪条目标值 (默认 30)：
- targetMood: 

按钮选项（建议 3~5 个；正向加分、安慰语气自然）示例格式：
| 文案 | moodDelta | 备注(可选) |
|------|-----------|-----------|
| 别怕，我会陪着你，我们慢慢来。 | +15 | 暖心主选项 |
| 要不要试试闭眼深呼吸三次？ | +8 | |
| 我猜你又在脑补最坏的结果~ | +6 | 带点调侃 |
| （搞怪）要不我帮你写作业？ | -5 | 触发彩蛋台词：… |

搞怪彩蛋台词：
- wrongClick1: 
- wrongClick2: 
- wrongClickRepeat: （多次点减分按钮后的特别提示）

## 2. 高考四科小游戏（Scene2）
语文诗句填空（数组）：
```
[
  {"front":"山有木兮木有枝，","blank":"心悦君兮君不知"},
  {"front":"示例：愿得一心人，","blank":"白首不相离"}
]
```
数学小题（数组; 结果字符串即可）：
```
[
  {"q":"520 + 1314 = ?","a":"1834"},
  {"q":"你=1 她=1 那我们= ? (填数字)","a":"2"}
]
```
英语配对（数组）：
```
[
  {"word":"destiny","match":"命运"},
  {"word":"warmth","match":"温暖"}
]
```
理综选择（数组）：
```
[
  {"q":"水沸腾锅盖水珠因?","options":["蒸发与冷凝","升华","分解"],"answerIndex":0}
]
```
错误答案提示语：
- examRetry: 
- examEncourage: （多次错误后给更暖一点）

## 3. 大学 timeline 场景（Scene3）
事件节点（需正确 order 从 1 开始递增）：
```
[
  {"text":"她递给我一支备用笔","order":1},
  {"text":"第一次一起自习","order":2},
  {"text":"我发现自己有点心动","order":3}
]
```
全部正确后的旁白：
- successNarration: 
错误时提示（可更感性）：
- reorderHint: 

## 4. 表白场景（Scene4）
台词顺序（数组，最后一条可为正式表白原话）：
```
[
  "其实有件事我想了很久……",
  "和你在一起的每个瞬间都让我想更靠近。",
  "如果未来可以继续这样慢慢走下去，我会很开心。",
  "<你的表白原话>"
]
```
分支回应：
- shy: 
- curious: 
- ok: 
隐藏彩蛋（点击星星 5 次出现的文本）：
- secretEgg: 

## 5. 第一次约会（Scene5）
话剧名称：
- playTitle: 
菜单（score 用来算默契，可自定义权重 0~3）：
```
[
  {"name":"前菜 · 番茄小暖汤","score":1},
  {"name":"主菜 · 柔软奶油意面","score":2},
  {"name":"主菜 · XXX","score":0},
  {"name":"甜点 · 心形慕斯","score":3},
  {"name":"饮品 · 橙子气泡水","score":1},
  {"name":"饮品 · 温牛奶","score":2}
]
```
得分区间文案（可按你们风格替换）：
- maxScoreText (>=7): 
- highScoreText (>=5): 
- midScoreText (>=3): 
- lowScoreText (<3): 

## 6. 围巾编织（Scene6）
网格尺寸（rows, cols，默认 8x14）：
- rows: 
- cols: 
心形/字母图案（可选，用二维数组或坐标列表表示需要预先点亮的格子）
```
[ [r,c], [r,c], ...]
```
完成后提示文本：
- finishScarfText: 

## 7. 未来愿望星空（Scene7）
需要愿望数量（默认 5）：
- required: 
最终告白（替换占位终章 message）：
- finalMessage: 
愿望输入限制或关键词彩蛋：
- specialKeywords: ["昵称1","内部梗2"]
- specialStarStyle 提示（例如“出现金色星星”）: 

## 8. 全局/通用
全局彩蛋关键词（可在任意输入检测）：
- globalKeywords: [ ]
多次错误统一鼓励语：
- globalEncourage: 

## 9. 背景音乐/音效
背景音乐文件名：
- bgm: 
点击音效：
- clickSfx: 
完成音效：
- successSfx: 

## 10. 版本与备注
- version: 1.0-initial-custom-template
- notes: 

---
## 下一步使用方法
1. 填写本文件。
2. 我将生成一个 `data/custom_content.json` 并编写一个 `loader` 读取并替换各场景占位。
3. 之后你只需改 JSON 即可迭代文案。

如果想先用 JSON 模板，请把本文件填写后发给我。