/**
 * Song Graded Training - 歌单分级训练模块
 * Lv.1 男低 → Lv.5 女声，渐进式歌曲跟唱训练
 */
class SongTrainer {
  constructor() {
    this.currentLevel = 1;
    this.currentSong = null;
    this.isActive = false;
    this.sessionData = [];          // [{timestamp, pitch, inRange}]
    this.sessionStartTime = null;
    this.pitchHistory = [];
    
    this.defineSongLibrary();
  }

  /**
   * 生成旋律数据 [{time, pitch, lyricIdx, syllableIdx}]
   * @param {string} lyrics - 换行分隔的歌词
   * @param {number} tonic - 主音频率 Hz
   * @param {number[]} contour - 每行旋律轮廓，半音偏移数组
   * @param {number} lineSec - 每行秒数
   */
  _mkMelody(lyrics, tonic, contour, lineSec) {
    const lines = lyrics.split('\n').filter(l => l.trim());
    const result = [];
    const ptsPerLine = contour.length;
    const secPerPt = lineSec / ptsPerLine;
    for (let li = 0; li < lines.length; li++) {
      const lineStart = li * lineSec;
      // 计算该行汉字数
      const chars = lines[li].replace(/[^\u4e00-\u9fff\w]/g, '').split('');
      const charCount = Math.max(1, chars.length);
      for (let pi = 0; pi < ptsPerLine; pi++) {
        // 根据时间位置分摊到具体字
        const fraction = pi / ptsPerLine;
        const si = Math.min(charCount - 1, Math.floor(fraction * charCount));
        result.push({
          time: Math.round((lineStart + pi * secPerPt) * 10) / 10,
          pitch: Math.round(tonic * Math.pow(2, contour[pi] / 12)),
          lyricIdx: li,
          syllableIdx: si
        });
      }
    }
    return result;
  }

  defineSongLibrary() {
    this.levels = {
      1: { name: '男低', range: [130, 220], note: 'C3-A3', color: '#4a90d9',
           desc: '建立音高感知基线，在舒适区内自由发声',
           songs: [
             { id: 's1_1', title: '素颜', artist: '许嵩', key: 'E', tonic: 165, hint: '用说话的感觉唱', bpm: 90,
               lyrics: '如果再看你一眼\n是否还会有感觉\n当年素面朝天\n要多纯洁就有多纯洁' },
             { id: 's1_2', title: '消愁', artist: '毛不易', key: 'G', tonic: 147, hint: '放松喉咙', bpm: 76,
               lyrics: '一杯敬朝阳 一杯敬月光\n唤醒我的向往 温柔了寒窗\n于是可以不回头地逆风飞翔\n不怕心头有雨 眼底有霜' },
             { id: 's1_3', title: '成都', artist: '赵雷', key: 'D', tonic: 175, hint: '像讲故事一样', bpm: 80,
               lyrics: '和我在成都的街头走一走\n直到所有的灯都熄灭了也不停留\n你会挽着我的衣袖\n我会把手揣进裤兜' },
             { id: 's1_4', title: '演员', artist: '薛之谦', key: 'B', tonic: 185, hint: '注意尾音平稳', bpm: 72,
               lyrics: '该配合你演出的我演视而不见\n在逼一个最爱你的人即兴表演\n什么时候我们开始收起了底线\n顺应时代的改变看那些拙劣的表演' }
           ]},
      2: { name: '男中', range: [147, 262], note: 'D3-C4', color: '#5cb8ff',
           desc: '扩展音域，感受喉位轻微上移',
           songs: [
             { id: 's2_1', title: '晴天', artist: '周杰伦', key: 'G', tonic: 196, hint: '副歌部分提气', bpm: 136,
               lyrics: '刮风这天 我试过握着你手\n但偏偏 雨渐渐\n大到我看你不见\n还要多久 我才能在你身边' },
             { id: 's2_2', title: '十年', artist: '陈奕迅', key: 'Ab', tonic: 208, hint: '保持胸腔打开', bpm: 60,
               lyrics: '十年之前 我不认识你\n你不属于我 我们还是一样\n陪在一个陌生人左右\n走过渐渐熟悉的街头' },
             { id: 's2_3', title: '说谎', artist: '林宥嘉', key: 'Bb', tonic: 233, hint: '注意气息支撑', bpm: 70,
               lyrics: '我没有说谎 我何必说谎\n你懂我的 我对你从来就不会假装\n我哪有说谎 请别以为你有多难忘\n笑是真的不是我逞强' },
             { id: 's2_4', title: '年少有为', artist: '李荣浩', key: 'B', tonic: 247, hint: '咬字轻一些', bpm: 78,
               lyrics: '假如我年少有为不自卑\n懂得什么是珍贵\n那些美梦\n没给你 我一生有愧' }
           ]},
      3: { name: '男高', range: [175, 330], note: 'F3-E4', color: '#00d4aa',
           desc: '激活CT肌发力，喉结明显上提',
           songs: [
             { id: 's3_1', title: '她说', artist: '林俊杰', key: 'C', tonic: 262, hint: '感受喉结上升', bpm: 72,
               lyrics: '等不到天黑 烟火不会太完美\n回忆烧成灰 还是等不到结尾\n她曾说的无所谓\n我怕一天一天被摧毁' },
             { id: 's3_2', title: '过火', artist: '张信哲', key: 'D', tonic: 294, hint: '软腭上抬', bpm: 66,
               lyrics: '怎么忍心怪你犯了错\n是我给你自由过了火\n让你更寂寞\n才会陷入感情漩涡' },
             { id: 's3_3', title: '月光', artist: '胡彦斌', key: 'E', tonic: 277, hint: '头声轻唱', bpm: 80,
               lyrics: '月光色 女子香\n泪断剑 情多长\n有多痛 无字想\n忘了你\n孤单魂 随风荡' },
             { id: 's3_4', title: '依然爱你', artist: '王力宏', key: 'A', tonic: 311, hint: '真假声切换', bpm: 84,
               lyrics: '我依然爱你 就是唯一的退路\n我依然珍惜 时时刻刻的幸福\n你每个呼吸 每个动作 每个表情\n到最后 一定会 依然爱你' }
           ]},
      4: { name: '中性', range: [220, 392], note: 'A3-G4', color: '#ffa502',
           desc: 'CT肌持续主导，共鸣开始向头腔迁移',
           songs: [
             { id: 's4_1', title: '大鱼', artist: '周深', key: 'F#', tonic: 311, hint: '模仿空灵感', bpm: 70,
               lyrics: '海浪无声将夜幕深深淹没\n漫过天空尽头的角落\n大鱼在梦境的缝隙里游过\n凝望你沉睡的轮廓' },
             { id: 's4_2', title: '小情歌', artist: '苏打绿', key: 'D', tonic: 294, hint: '用鼻咽共鸣', bpm: 65,
               lyrics: '这是一首简单的小情歌\n唱着人们心肠的曲折\n我想我很快乐\n当有你的温热\n脚边的空气转了' },
             { id: 's4_3', title: '起风了', artist: '吴青峰', key: 'E', tonic: 330, hint: '把声音往前送', bpm: 76,
               lyrics: '我曾将青春翻涌成她\n也曾指尖弹出盛夏\n心之所动 且就随缘去吧\n逆着光行走 任风吹雨打' },
             { id: 's4_4', title: '烟火里的尘埃', artist: '华晨宇', key: 'F', tonic: 349, hint: '注意高音不要挤', bpm: 72,
               lyrics: '我就是我 我只是我\n只是一场烟火散落的尘埃\n风阵阵吹过来\n风一去不回来\n悲不悲哀' }
           ]},
      5: { name: '女声', range: [262, 523], note: 'C4-C5', color: '#e94560',
           desc: '头腔共鸣主导，目标音色达成！',
           songs: [
             { id: 's5_1', title: '泡沫', artist: '邓紫棋', key: 'E', tonic: 330, hint: '用气息托住高音', bpm: 68,
               lyrics: '美丽的泡沫 虽然一刹花火\n你所有承诺 虽然都太脆弱\n爱本是泡沫 如果能够看破\n有什么难过' },
             { id: 's5_2', title: '红豆', artist: '王菲', key: 'C', tonic: 262, hint: '气声轻唱', bpm: 56,
               lyrics: '有时候 有时候\n我会相信一切有尽头\n相聚离开 都有时候\n没有什么会永垂不朽' },
             { id: 's5_3', title: '隐形的翅膀', artist: '张韶涵', key: 'C#', tonic: 277, hint: '打开头腔', bpm: 72,
               lyrics: '我终于看到 所有梦想都开花\n追逐的年轻 歌声多嘹亮\n我终于翱翔 用心凝望不害怕\n哪里会有风 就飞多远吧' },
             { id: 's5_4', title: '小幸运', artist: '田馥甄', key: 'F', tonic: 349, hint: '保持音色亮度', bpm: 80,
               lyrics: '原来你是我最想留住的幸运\n原来我们和爱情曾经靠得那么近\n那为我对抗世界的决定\n那陪我淋的雨\n一幕幕都是你' }
           ]}
    };

    // 为每首歌生成旋律数据
    // 轮廓模式：[主音,上行,高音,下行,主音,低音] 半音偏移
    const patterns = {
      rising:   [0, 2, 4, 5, 4, 2],
      falling:  [5, 4, 2, 0, -2, 0],
      wave:     [0, 2, 4, 2, 0, -2],
      high:     [4, 5, 7, 5, 4, 2],
      flat:     [0, 1, 2, 1, 0, -2],
      gentle:   [0, 2, 3, 2, 0, -3],
      dramatic: [0, 4, 7, 4, 0, -3],
    };

    const styleMap = {
      s1_1: 'gentle', s1_2: 'flat', s1_3: 'wave', s1_4: 'falling',
      s2_1: 'rising', s2_2: 'wave', s2_3: 'gentle', s2_4: 'flat',
      s3_1: 'wave', s3_2: 'dramatic', s3_3: 'gentle', s3_4: 'rising',
      s4_1: 'wave', s4_2: 'gentle', s4_3: 'high', s4_4: 'dramatic',
      s5_1: 'dramatic', s5_2: 'flat', s5_3: 'high', s5_4: 'wave'
    };

    for (let lv = 1; lv <= 5; lv++) {
      this.levels[lv].songs.forEach(s => {
        const pat = patterns[styleMap[s.id]] || patterns.wave;
        const lyrics = s.lyrics;
        const lineCount = lyrics.split('\n').filter(l => l.trim()).length;
        const lineSec = Math.max(4, 20 / lineCount); // 总共约20秒
        s.melody = this._mkMelody(lyrics, s.tonic, pat, lineSec);
        s.melodyDuration = lineCount * lineSec;
      });
    }
  }

  getLevelInfo(level) {
    return this.levels[level] || this.levels[1];
  }

  getSongsForLevel(level) {
    return this.levels[level] ? this.levels[level].songs : [];
  }

  getAllSongs() {
    const all = [];
    for (let lv = 1; lv <= 5; lv++) {
      this.levels[lv].songs.forEach(s => all.push({ ...s, level: lv }));
    }
    return all;
  }

  startSession(level, songId) {
    this.currentLevel = level;
    this.currentSong = this.findSong(level, songId);
    this.isActive = true;
    this.sessionData = [];
    this.pitchHistory = [];
    this.sessionStartTime = Date.now();
    return this.currentSong;
  }

  findSong(level, songId) {
    const songs = this.getSongsForLevel(level);
    return songs.find(s => s.id === songId) || songs[0];
  }

  /**
   * Called on each audio frame during training.
   * @param {number} pitch - Current detected pitch in Hz
   * @returns {object} { inRange, rangePct, status }
   */
  feedPitch(pitch) {
    if (!this.isActive || !pitch) return { inRange: false, rangePct: 0, status: 'no_signal' };

    const range = this.getLevelInfo(this.currentLevel).range;
    const [low, high] = range;
    
    this.pitchHistory.push(pitch);
    if (this.pitchHistory.length > 50) this.pitchHistory.shift();

    const avgPitch = this.pitchHistory.reduce((a,b)=>a+b,0) / this.pitchHistory.length;
    const inRange = avgPitch >= low && avgPitch <= high;
    
    // Calculate how far from target center (as percentage)
    const center = (low + high) / 2;
    const maxDeviation = (high - low) / 2;
    const deviation = Math.abs(avgPitch - center);
    const rangePct = Math.max(0, Math.min(100, 100 - (deviation / maxDeviation) * 100));

    let status = 'no_signal';
    if (inRange) {
      status = rangePct > 80 ? 'excellent' : rangePct > 50 ? 'good' : 'ok';
    } else {
      status = avgPitch < low ? 'too_low' : 'too_high';
    }

    this.sessionData.push({
      timestamp: Date.now() - this.sessionStartTime,
      pitch: avgPitch,
      inRange,
      rangePct
    });

    return { inRange, rangePct: Math.round(rangePct), status };
  }

  stopSession() {
    this.isActive = false;
    const duration = (Date.now() - this.sessionStartTime) / 1000;
    const result = this.calculateScore();
    result.duration = duration;
    return result;
  }

  calculateScore() {
    if (this.sessionData.length === 0) {
      return { score: 0, accuracy: 0, consistency: 0, timeInRange: 0 };
    }

    // Accuracy: % of data points in target range
    const inRangeCount = this.sessionData.filter(d => d.inRange).length;
    const accuracy = Math.round((inRangeCount / this.sessionData.length) * 100);

    // Consistency: standard deviation of rangePct (lower = more consistent)
    const rangePcts = this.sessionData.map(d => d.rangePct);
    const avgPct = rangePcts.reduce((a,b)=>a+b,0) / rangePcts.length;
    const variance = rangePcts.reduce((s,p) => s + Math.pow(p-avgPct,2), 0) / rangePcts.length;
    const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance) * 2));

    // Time in range: percentage of session time where pitch was in target
    const timeInRange = accuracy; // simplified: same as accuracy for now

    // Overall score: weighted
    const score = Math.round(accuracy * 0.5 + consistency * 0.3 + timeInRange * 0.2);

    return { score, accuracy, consistency, timeInRange };
  }

  getLevelProgressSummary() {
    const summary = {};
    for (let lv = 1; lv <= 5; lv++) {
      summary[lv] = {
        name: this.levels[lv].name,
        range: this.levels[lv].note,
        totalSongs: this.levels[lv].songs.length,
        completedSongs: 0,
        unlocked: lv === 1
      };
    }
    return summary;
  }
}

window.SongTrainer = SongTrainer;
