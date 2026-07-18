# 🏗️ 改造框架文档

> 基于 MTFVocalTrainer 开源项目，在现有架构上增量改造，不重写不推翻。

---

## 一、现有架构分析

### 1.1 模块依赖链

```
storage.js ─────────────────────────────────────────┐
    ↑                                               │
gamification.js ───────────────────────┐            │
    ↑                                  │            │
audio.js ──→ pitch-detector.js         │            │
    │            ↓                      │            │
    │       formant-analyzer.js         │            │
    │            ↓                      │            │
    └──────→  app.js  ←── charts.js ────┘            │
               ↑                                     │
          gamification.js ──→ storage.js ────────────┘
```

加载顺序（index.html）：`storage → gamification → audio → pitch-detector → formant-analyzer → charts → app`

### 1.2 各模块职责

| 模块 | 行数 | 职责 | 对外暴露 |
|------|------|------|---------|
| `storage.js` | 289 | LocalStorage 读写，settings/progress/gamification/history 四条数据线 | `getProgress()`, `getSettings()`, `addXP()`, `updateStreak()` 等 |
| `gamification.js` | 268 | 成就定义+检查、分数计算、XP奖励 | `calculatePitchScore()`, `awardXP()`, `checkAchievement()` |
| `audio.js` | 156 | Web Audio API，麦克风采集，ScriptProcessor 实时回调 | `initialize()`, `startRecording(callback)`, `stopRecording()` |
| `pitch-detector.js` | 246 | YIN 自相关算法 + 辅助：滑动平均、标准差、频率↔音符互转 | `detectPitch()`, `getAveragePitch()`, `isOnTarget()`, `frequencyToNote()` |
| `formant-analyzer.js` | 188 | LPC 共振峰 F1/F2/F3 提取 + 稳定性/亮度比 | `analyzeFormants()`, `getBrightnessRatio()`, `getResonanceStability()` |
| `charts.js` | 278 | Canvas 绑图：音高表、趋势线、进度条、打卡日历 | `drawPitchMeter()`, `drawLineChart()`, `drawProgressBar()` |
| `app.js` | ~2000+ | 主控制器：导航、练习流程、结果计算、UI更新 | `navigateTo()`, `startPitchExercise()`, 所有业务逻辑 |

### 1.3 数据模型（Storage schema）

```json
{
  "settings":    { targetNote, targetFrequency, darkMode, notificationsEnabled },
  "progress":    { currentSection, section1~4Stats, section2~4Unlocked },
  "gamification":{ level, xp, streak, achievements[], dailyPracticeMinutes{} },
  "history":     { sessions[], pitchHistory[], resonanceHistory[] }
}
```

### 1.4 用户界面结构

```
index.html (单文件 SPA)
├── HomeScreen      → 4张训练卡片 + XP进度条 + 打卡日历
├── section1Screen  → 音高训练（哼鸣，0Hz音高表 + 实时统计）
├── section2Screen  → 高级音高（句子跟读，旋律稳定性）
├── section3Screen  → 共鸣训练（F1/F2监测，亮度比）
├── section4Screen  → 词语练习（元音→单词→短语）
├── achievementsScreen → 成就列表
├── progressScreen  → 历史图表
└── settingsScreen  → 目标音高/主题/数据导出
```

### 1.5 关键特征总结

**优点：**
- 架构清晰，模块职责明确，依赖简单
- YIN 算法自实现，不依赖外部库
- 游戏化系统成熟（15+成就，XP/等级/打卡/冻结）
- PWA 离线可用

**局限：**
- 所有代码在一个 HTML 里通过 `<script>` 加载，`window.Xxx` 全局暴露
- 无构建工具，无模块化（ES modules）
- 没有外部API调用能力
- Charts 模块较基础，只支持折线图和进度条

---

## 二、改造目标

### 2.1 新增模块（按优先级）

```
P0: 共鸣热力图增强     —— 增强现有 formant-analyzer + charts
P0: 歌单分级训练 Section —— 新增 song-trainer.js + HTML Section
P1: AI教练引擎         —— 新增 ai-coach.js（规则引擎，后期可接LLM）
P1: 难度自适应         —— 增强 app.js 评分逻辑
P2: AI对话教练         —— 新增 conversation-coach.js + HTML Section
```

### 2.2 改造原则

1. **增量不改写**：不重构现有代码，新功能以新文件/新HTML块插入
2. **保持模块模式**：新模块同样用 `class → window.Xxx` 模式，保持一致性
3. **向后兼容**：不破坏现有 Storage schema，用新增字段扩展
4. **渐进增强**：AI 教练先做规则引擎，后续再考虑接入 LLM API

---

## 三、详细改造方案

### 3.1 P0-A：共鸣位置热力图（Enhance Section 3）

**现状**：Section 3 只显示 F1/F2 数值和亮度比，不够直观。

**改造内容**：

1. 新增 `charts.js` 方法：`drawResonanceHeatmap(canvas, f1, f2, history)`
   - 2D 散点图，X轴=F1，Y轴=F2
   - 绘制典型男性/女性共鸣区域作为参考框
   - 实时绘制用户当前共鸣位置点
   - 历史轨迹连线

2. 修改 `app.js` 中 Section 3 的录音回调，实时传入 formant 数据给热力图

3. 典型共鸣参考区域（基于声学研究）：
   ```
   男性典型区：F1=400-600Hz, F2=1000-1500Hz
   女性典型区：F1=600-900Hz, F2=1500-2500Hz
   ```

**新增文件**：无（纯增强）

**改动文件**：`charts.js`（+80行），`app.js`（Section 3 回调 +20行），`index.html`（增加 canvas +1行）

---

### 3.2 P0-B：歌单分级训练 Section 5

**设计思路**：利用现有音高检测能力，播放歌曲 → 用户跟唱 → 实时音高匹配评分。

**核心功能**：

```
歌单分级训练
├── Lv.1 男低 (C3-A3, 130-220Hz)    → 许嵩/毛不易
├── Lv.2 男中 (D3-C4, 147-262Hz)    → 周杰伦/陈奕迅
├── Lv.3 男高 (F3-E4, 175-330Hz)    → 林俊杰/张信哲
├── Lv.4 中性 (A3-G4, 220-392Hz)    → 周深/苏打绿
└── Lv.5 女声 (C4-C5, 262-523Hz)    → 邓紫棋/王菲
```

**数据结构设计**：

```javascript
// 新增到 storage.js 的 progress
progress: {
  songTraining: {
    currentLevel: 1,        // 1-5
    completedSongs: [],     // [{id, score, date}]
    levelStats: {           // 每级统计
      "1": { songsCompleted: 0, avgScore: 0, attempts: 0 }
    }
  }
}
```

**技术实现**：

1. 新增 `song-trainer.js`：
   - 内置歌单数据（歌名、歌手、目标音高范围、YouTube/音源URL）
   - 管理分级逻辑和评分
   - 配合 `pitch-detector.js` 做实时音高对比

2. 歌曲播放方案选择：
   - **方案A（推荐）**：用户自行准备 MP3 文件，用 `<input type="file">` 上传 + `<audio>` 播放
   - **方案B**：嵌入 YouTube iframe（需网络）
   - **方案C**：MIDI 合成伴奏 + 纯人声模式

3. 实时评分逻辑：
   - 每 100ms 采样一次用户音高
   - 与歌曲的目标音高范围做对比
   - 实时显示"✅在调 / ⚠️偏高 / ⚠️偏低"
   - 结束后给出综合得分（音高匹配度 %）

**新增文件**：`public/js/song-trainer.js`（~300行）

**改动文件**：
- `app.js`（新增 Section 5 方法 +150行）
- `storage.js`（新增 songTraining 数据字段 +30行）
- `index.html`（新增 Section 5 HTML 块 +80行）
- `charts.js`（新增 `drawSongPitchTracker()` +50行）

---

### 3.3 P1-A：AI 教练引擎

**设计思路**：基于规则引擎分析用户表现，生成针对性的教练提示。不依赖外部 API，离线可用。

**核心逻辑**：

```javascript
class AICoach {
  analyze(pitchData, resonanceData, exerciseContext) {
    const tips = [];
    
    // 规则1：音高偏低 → 提示喉结上提
    if (avgPitch < targetRange.min) {
      tips.push({ type: 'pitch', severity: 'warn', 
        message: '喉结再往上提一点，像闻花香一样轻轻吸气，感受喉结自然上升' });
    }
    
    // 规则2：共鸣偏胸腔 → 提示声音往前送
    if (brightnessRatio < 1.5) {
      tips.push({ type: 'resonance', severity: 'warn',
        message: '把声音往眉心送，想象声音从额头前方发出' });
    }
    
    // 规则3：稳定性差 → 提示放慢
    if (stdDev > 10) {
      tips.push({ type: 'stability', severity: 'info',
        message: '音高波动较大，尝试放慢速度，先稳定在一个音上' });
    }
    
    // 规则4：持续达标 → 鼓励升级
    if (consecutivePasses >= 3) {
      tips.push({ type: 'progress', severity: 'success',
        message: '你已经连续3次达标！建议尝试下一级难度' });
    }
    
    return tips;
  }
}
```

**新增文件**：`public/js/ai-coach.js`（~200行）

**改动文件**：
- `app.js`（各 Section 回调中加入 `aiCoach.analyze()` 调用，每处 +5行）
- `index.html`（各 Section 底部增加 AI 提示显示区，每处 +10行）

---

### 3.4 P1-B：难度自适应升降级

**设计思路**：在现有 unlock/lock 逻辑基础上，加入自动升降级。

**规则**：

```
连续3次达标（如 stdDev < 5Hz，或 音高匹配度 > 85%）
  → 自动建议升级（弹窗询问，或自动升）

连续5次不达标
  → 自动降级，弹窗提示"建议回上一级巩固基础"
```

**实现**：增强 `app.js` 中各 Section 的结果处理逻辑，在 `storage.js` 中跟踪连续成功/失败计数。

**改动文件**：`app.js`（~+40行），`storage.js`（~+20行）

---

### 3.5 P2：AI 对话教练模式 Section 6

**设计思路**：AI 用女声音高范围朗读一句，用户跟读，实时获得反馈。纯前端方案，不依赖后端。

**核心功能**：

1. **内置对话库**（按难度分级）：
   - D1（150-170Hz）：短句慢速 "今天天气真不错"
   - D2（170-200Hz）：日常对话 "你好，我想点一杯拿铁"
   - D3（200-240Hz）：带情绪的长句 "哎呀你怎么才来呀，我都等你好久了～"

2. **流程**：
   ```
   AI播放参考音频（TTS 女声）→ 用户跟读 → 实时音高对比 → 得分反馈 → 下一句
   ```

3. **TTS方案**：
   - Web Speech API (`speechSynthesis`) 免费，离线，支持中文
   - 可调整 `pitch` 参数模拟女声

4. **新增 `conversation-coach.js`**：
   - 管理对话库和流程
   - 跟读评分
   - 对话模拟（AI 问 → 用户答）

**新增文件**：`public/js/conversation-coach.js`（~250行）

**改动文件**：
- `app.js`（新增 Section 6 方法 +150行）
- `index.html`（新增 Section 6 HTML 块 +80行）
- `storage.js`（新增 conversationTraining 数据 +20行）

---

## 四、文件变更总览

| 操作 | 文件 | 预计行数 |
|------|------|---------|
| **新增** | `public/js/song-trainer.js` | ~300 |
| **新增** | `public/js/ai-coach.js` | ~200 |
| **新增** | `public/js/conversation-coach.js` | ~250 |
| **增强** | `public/js/app.js` | +400 |
| **增强** | `public/js/storage.js` | +80 |
| **增强** | `public/js/charts.js` | +130 |
| **增强** | `public/index.html` | +250 |
| **增强** | `public/css/styles.css` | +100 |

**总计新增代码量**：~1700 行（分散在 8 个文件中）

---

## 五、实施顺序建议

```
第1轮（本周）：共鸣热力图 P0-A
  └── 改动最小，效果最明显，验证改造流程

第2轮（下周）：歌单分级训练 P0-B
  └── 核心差异化功能，工作量最大

第3轮：AI教练 P1-A + 难度自适应 P1-B
  └── 依赖前两轮的数据积累来优化规则

第4轮：AI对话教练 P2
  └── 锦上添花，打磨完整体验
```

---

## 六、后续扩展方向（远期）

- 接入真实 LLM API（OpenAI/本地 Ollama）做更智能的教练对话
- 社区歌单分享功能
- 语音波形回放 + AI 对比分析
- 移动端原生封装（Capacitor/React Native）
