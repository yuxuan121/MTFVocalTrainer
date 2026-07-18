/**
 * AI Coach Rule Engine - 智能教练规则引擎
 * 基于用户表现数据生成针对性训练建议，纯前端规则驱动
 */
class AICoach {
  constructor() {
    // 各维度历史记录，用于趋势分析
    this.history = {
      pitch: [],        // { avgHz, stdDev, time }
      resonance: [],    // { f1, f2, brightness, time }
      songs: []         // { level, score, accuracy, time }
    };
    this.maxHistory = 20;

    // 实时会话监控
    this.session = {
      active: false,
      startTime: null,
      totalVoiceSeconds: 0,       // 累计发声时长（秒）
      lastVoiceTime: null,
      samples: [],                // [{ time, pitch, stdDev }]
      fatigueScore: 0,            // 0-100，越高越疲劳
      breakWarnings: 0,           // 已发出的休息提醒次数
      drinkReminders: 0,          // 已发出的喝水提醒次数
      dailyTotalMinutes: 0        // 今日累计练习分钟（从storage同步）
    };
    // 疲劳检测参数
    this.FATIGUE_PITCH_DROP = 20;      // 音高下降超过20Hz视为疲劳信号
    this.FATIGUE_STDDEV_RISE = 8;      // 标准差上升超过8Hz视为疲劳信号
    this.SESSION_MAX_MINUTES = 20;     // 单次会话最大时长（分钟）
    this.DRINK_INTERVAL_MINUTES = 15;  // 每隔15分钟提醒喝水
    this.FATIGUE_SAMPLE_WINDOW = 60;   // 疲劳检测采样窗口（秒）
  }

  /**
   * 分析音高训练结果，返回教练建议
   */
  analyzePitch(pitchData) {
    const { avgPitch, targetFreq, stdDev, duration, consecutivePasses } = pitchData;
    const tips = [];

    // 规则1：音高严重偏低
    if (avgPitch < 150) {
      tips.push({
        id: 'pitch_critical_low',
        type: 'pitch',
        severity: 'error',
        icon: '⚠️',
        message: '音高掉到 150Hz 以下了！先停下来，重新找到喉结上提的感觉——像闻花香一样轻轻吸气，感受喉结自然上升。'
      });
    }
    // 规则2：音高偏低但可控
    else if (avgPitch < targetFreq - 10) {
      tips.push({
        id: 'pitch_low',
        type: 'pitch',
        severity: 'warn',
        icon: '📉',
        message: '音高偏低。尝试把声音想象成从额头前方发出，而不是从喉咙底部挤出来。用手摸喉结，感受它是否在上方位置。'
      });
    }
    // 规则3：音高偏高
    else if (avgPitch > targetFreq + 15) {
      tips.push({
        id: 'pitch_high',
        type: 'pitch',
        severity: 'warn',
        icon: '📈',
        message: '音高偏高了。放松声带，不要过度用力。试着用叹气的感觉发声，让音高自然落到目标区间。'
      });
    }
    // 规则4：稳定性差
    if (stdDev > 10) {
      tips.push({
        id: 'stability_poor',
        type: 'stability',
        severity: 'warn',
        icon: '🌊',
        message: `音高波动较大（σ=${stdDev.toFixed(1)}Hz）。先不要追求高音，专注于稳定。试着延长一个音符，保持3秒不变。`
      });
    }
    // 规则5：稳定性优秀
    else if (stdDev < 5 && avgPitch >= 150) {
      tips.push({
        id: 'stability_great',
        type: 'stability',
        severity: 'success',
        icon: '💎',
        message: `稳定性非常好（σ=${stdDev.toFixed(1)}Hz）！你的喉部肌肉控制力在提升。继续保持这个感觉。`
      });
    }
    // 规则6：连续达标 → 鼓励升级
    if (consecutivePasses >= 3) {
      tips.push({
        id: 'progress_upgrade',
        type: 'progress',
        severity: 'success',
        icon: '🎉',
        message: `你已经连续 ${consecutivePasses} 次达标！喉部肌肉已经适应了当前难度，建议尝试下一级训练。`
      });
    }
    // 规则7：练习时长提醒
    if (duration > 120) {
      tips.push({
        id: 'rest_reminder',
        type: 'health',
        severity: 'info',
        icon: '💧',
        message: '你已经练习超过2分钟了。记得喝水休息一下，过度训练反而会让肌肉疲劳，影响效果。'
      });
    }

    // 记录历史
    this.history.pitch.push({ avgPitch, stdDev, time: Date.now() });
    if (this.history.pitch.length > this.maxHistory) this.history.pitch.shift();

    return tips;
  }

  /**
   * 分析共鸣训练结果
   */
  analyzeResonance(resonanceData) {
    const { f1, f2, brightness, stability, pitch } = resonanceData;
    const tips = [];

    // 规则：共鸣偏胸腔（男性化）
    if (brightness && brightness < 1.5) {
      tips.push({
        id: 'resonance_chest',
        type: 'resonance',
        severity: 'warn',
        icon: '🔴',
        message: '你的共鸣位置偏胸腔（亮度比偏低）。试着做「闭嘴哼鸣 mmm」，把震动感从胸口移到嘴唇和鼻子。'
      });
    }
    // 规则：共鸣接近女性区
    else if (brightness && brightness >= 2.0) {
      tips.push({
        id: 'resonance_head',
        type: 'resonance',
        severity: 'success',
        icon: '🟢',
        message: `共鸣位置不错（亮度比 ${brightness.toFixed(2)}）！你的声音正在向头腔迁移。保持「声音从眉心出来」的感觉。`
      });
    }
    // 规则：共鸣在过渡区
    else if (brightness && brightness >= 1.5) {
      tips.push({
        id: 'resonance_transition',
        type: 'resonance',
        severity: 'info',
        icon: '🟡',
        message: '共鸣处于过渡区。继续用「Silent K」技巧（像要说 "key" 但停在 k 的位置），感受喉部上方的空间感。'
      });
    }
    // 规则：共鸣稳定性
    if (stability > 15) {
      tips.push({
        id: 'resonance_unstable',
        type: 'resonance',
        severity: 'warn',
        icon: '🌊',
        message: '共鸣位置不稳定。试试延长一个 "mmm" 哼鸣，专注于保持嘴唇和鼻子的震动感不消失。'
      });
    }

    this.history.resonance.push({ f1, f2, brightness, time: Date.now() });
    if (this.history.resonance.length > this.maxHistory) this.history.resonance.shift();

    return tips;
  }

  /**
   * 分析歌单训练结果
   */
  analyzeSong(songData) {
    const { level, score, accuracy, consistency, songName } = songData;
    const tips = [];

    // 规则：得分低
    if (score < 40) {
      tips.push({
        id: 'song_struggle',
        type: 'song',
        severity: 'warn',
        icon: '💪',
        message: `《${songName}》的得分偏低。先不要整首唱，只唱副歌部分的高潮段落，反复练习那个音高区间。`
      });
    }
    // 规则：得分中
    else if (score < 70) {
      tips.push({
        id: 'song_improving',
        type: 'song',
        severity: 'info',
        icon: '📈',
        message: `有进步空间！你的音高匹配度是 ${accuracy}%。试着先听原唱跟唱，感受目标音高的位置，再清唱。`
      });
    }
    // 规则：得分高
    else {
      tips.push({
        id: 'song_great',
        type: 'song',
        severity: 'success',
        icon: '🌟',
        message: `《${songName}》唱得很棒！得分 ${score}。你可以尝试同一级别的其他歌曲巩固，或者挑战下一级。`
      });
    }
    // 规则：高级别挣扎
    if (level >= 4 && score < 50) {
      tips.push({
        id: 'song_downgrade',
        type: 'song',
        severity: 'warn',
        icon: '🔙',
        message: '高级别的歌曲难度较大。建议回到 Lv.3 多练几首，巩固 CT 肌力量后再来挑战。'
      });
    }

    this.history.songs.push({ level, score, accuracy, time: Date.now() });
    if (this.history.songs.length > this.maxHistory) this.history.songs.shift();

    return tips;
  }

  /**
   * 获取实时练习中的简短语提示（显示在界面上）
   */
  getLiveHint(pitch, rangeLow, rangeHigh, status) {
    const center = (rangeLow + rangeHigh) / 2;
    if (!pitch) return { icon: '🔇', text: '等待声音...', color: '#a4b0be' };
    
    if (status === 'too_low') {
      const gap = rangeLow - pitch;
      if (gap > 50) return { icon: '⬆️', text: '喉结上提！差太多了', color: '#ff4757' };
      return { icon: '⬆️', text: `再高一点，目标 ${rangeLow}Hz 以上`, color: '#ffa502' };
    }
    if (status === 'too_high') {
      return { icon: '⬇️', text: '放松一点，用叹气的感觉', color: '#ffa502' };
    }
    if (status === 'excellent') {
      return { icon: '✨', text: '就是这个感觉！记住它', color: '#2ed573' };
    }
    if (status === 'good') {
      return { icon: '👍', text: '不错，保持住', color: '#00d9ff' };
    }
    return { icon: '🎵', text: '继续...', color: '#fff' };
  }

  /**
   * ============ 实时会话监控系统 ============
   */

  /**
   * 开始监控会话
   */
  startMonitoring(dailyMinutes) {
    this.session.active = true;
    this.session.startTime = Date.now();
    this.session.totalVoiceSeconds = 0;
    this.session.samples = [];
    this.session.fatigueScore = 0;
    this.session.breakWarnings = 0;
    this.session.drinkReminders = 0;
    this.session.dailyTotalMinutes = dailyMinutes || 0;
  }

  /**
   * 结束监控会话
   */
  stopMonitoring() {
    this.session.active = false;
    return this.getSessionReport();
  }

  /**
   * 每帧喂入样本进行疲劳检测
   * @param {number} pitch - 当前音高 Hz（null 表示静音）
   * @param {number} stdDev - 当前稳定性
   */
  feedSample(pitch, stdDev) {
    if (!this.session.active) return null;

    const now = Date.now();

    // 跟踪发声时间
    if (pitch) {
      if (this.session.lastVoiceTime) {
        this.session.totalVoiceSeconds += (now - this.session.lastVoiceTime) / 1000;
      }
      this.session.lastVoiceTime = now;
    } else {
      this.session.lastVoiceTime = null;
    }

    // 记录样本
    this.session.samples.push({ time: now, pitch: pitch || 0, stdDev: stdDev || 0 });
    // 保留最近窗口的样本
    const cutoff = now - this.FATIGUE_SAMPLE_WINDOW * 1000;
    while (this.session.samples.length > 0 && this.session.samples[0].time < cutoff) {
      this.session.samples.shift();
    }

    // 计算疲劳分数
    this.session.fatigueScore = this._calculateFatigue();

    // 检查是否需要提醒
    return this.shouldTakeBreak();
  }

  /**
   * 计算疲劳分数 0-100
   */
  _calculateFatigue() {
    const samples = this.session.samples.filter(s => s.pitch > 0);
    if (samples.length < 10) return 0;

    const half = Math.floor(samples.length / 2);
    const early = samples.slice(0, half);
    const recent = samples.slice(half);

    const earlyAvg = early.reduce((s, a) => s + a.pitch, 0) / early.length;
    const recentAvg = recent.reduce((s, a) => s + a.pitch, 0) / recent.length;
    const earlyStd = Math.sqrt(early.reduce((s, a) => s + Math.pow(a.stdDev, 2), 0) / early.length);
    const recentStd = Math.sqrt(recent.reduce((s, a) => s + Math.pow(a.stdDev, 2), 0) / recent.length);

    let score = 0;

    // 音高下降 → 喉部肌肉疲劳
    const pitchDrop = earlyAvg - recentAvg;
    if (pitchDrop > 0) {
      score += Math.min(50, (pitchDrop / this.FATIGUE_PITCH_DROP) * 50);
    }

    // 稳定性变差 → 控制力下降
    const stdRise = recentStd - earlyStd;
    if (stdRise > 0) {
      score += Math.min(50, (stdRise / this.FATIGUE_STDDEV_RISE) * 50);
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * 判断是否应该休息
   * @returns {object|null} null 表示不需要，否则返回提醒对象
   */
  shouldTakeBreak() {
    if (!this.session.active) return null;

    const elapsed = (Date.now() - this.session.startTime) / 1000; // 秒
    const voiceMin = this.session.totalVoiceSeconds / 60;
    const elapsedMin = elapsed / 60;
    const totalMin = this.session.dailyTotalMinutes + elapsedMin;

    // 检查1：今日总练习时长超过40分钟 → 强烈建议休息
    if (totalMin > 40 && this.session.breakWarnings < 3) {
      this.session.breakWarnings++;
      return {
        id: 'daily_limit',
        type: 'health',
        severity: 'error',
        icon: '🛑',
        message: `你今天已经练习了 ${Math.round(totalMin)} 分钟。嗓子需要休息了，过度训练会导致肌肉劳损。建议今天就到这里，明天继续！`,
        action: 'stop'
      };
    }

    // 检查2：单次会话超过20分钟 → 建议休息
    if (elapsedMin > this.SESSION_MAX_MINUTES && this.session.breakWarnings < 2) {
      this.session.breakWarnings++;
      return {
        id: 'session_limit',
        type: 'health',
        severity: 'warn',
        icon: '⏰',
        message: `你已经连续练习 ${Math.round(elapsedMin)} 分钟了。喉部肌肉需要休息恢复。建议暂停5-10分钟，喝点水再继续。`,
        action: 'pause'
      };
    }

    // 检查3：疲劳分数超过60 → 嗓音质量明显下降
    if (this.session.fatigueScore > 60 && this.session.breakWarnings < 2) {
      this.session.breakWarnings++;
      return {
        id: 'fatigue_detected',
        type: 'health',
        severity: 'warn',
        icon: '😮‍💨',
        message: `检测到你的嗓音质量在下降（疲劳指数 ${this.session.fatigueScore}%）。音高在降低，稳定性在变差——这是喉部肌肉疲劳的典型信号。建议停下来休息一会儿。`,
        action: 'pause'
      };
    }

    // 检查4：每15分钟提醒喝水
    if (elapsedMin > this.DRINK_INTERVAL_MINUTES && 
        this.session.drinkReminders < Math.floor(elapsedMin / this.DRINK_INTERVAL_MINUTES)) {
      this.session.drinkReminders = Math.floor(elapsedMin / this.DRINK_INTERVAL_MINUTES);
      return {
        id: 'drink_water',
        type: 'health',
        severity: 'info',
        icon: '💧',
        message: `已经练习 ${Math.round(elapsedMin)} 分钟了，记得喝口水。声带需要保持湿润才能发出好的声音。`,
        action: 'none'
      };
    }

    // 检查5：轻度疲劳提醒
    if (this.session.fatigueScore > 30 && this.session.breakWarnings === 0) {
      return {
        id: 'mild_fatigue',
        type: 'health',
        severity: 'info',
        icon: '🔔',
        message: `你的嗓音开始有些疲劳迹象（指数 ${this.session.fatigueScore}%）。注意感受喉部，如果觉得累了就休息。`,
        action: 'none'
      };
    }

    return null;
  }

  /**
   * 获取会话状态摘要（用于界面显示）
   */
  getSessionStatus() {
    if (!this.session.active) return null;
    const elapsed = (Date.now() - this.session.startTime) / 1000;
    return {
      elapsedSeconds: elapsed,
      elapsedMinutes: Math.round(elapsed / 60),
      voiceSeconds: this.session.totalVoiceSeconds,
      voiceMinutes: Math.round(this.session.totalVoiceSeconds / 60),
      fatigueScore: this.session.fatigueScore,
      dailyTotal: Math.round(this.session.dailyTotalMinutes + elapsed / 60),
      isFatigued: this.session.fatigueScore > 40,
      statusIcon: this.session.fatigueScore > 60 ? '🔴' : this.session.fatigueScore > 30 ? '🟡' : '🟢',
      statusText: this.session.fatigueScore > 60 ? '需要休息' : this.session.fatigueScore > 30 ? '轻度疲劳' : '状态良好'
    };
  }

  /**
   * 获取会话报告
   */
  getSessionReport() {
    const elapsed = this.session.startTime ? (Date.now() - this.session.startTime) / 1000 : 0;
    return {
      durationMinutes: Math.round(elapsed / 60),
      voiceMinutes: Math.round(this.session.totalVoiceSeconds / 60),
      samplesCollected: this.session.samples.length,
      peakFatigue: this.session.fatigueScore,
      breakWarnings: this.session.breakWarnings,
      drinkReminders: this.session.drinkReminders
    };
  }

  /**
   * 获取当前练习的总结合提示
   */
  getSummary(section, data) {
    if (section === 'pitch') return this.analyzePitch(data);
    if (section === 'resonance') return this.analyzeResonance(data);
    if (section === 'song') return this.analyzeSong(data);
    return [];
  }
}

window.AICoach = AICoach;