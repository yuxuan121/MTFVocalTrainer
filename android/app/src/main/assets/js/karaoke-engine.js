/**
 * KaraokeEngine - 全民K歌式实时音高对比打分引擎
 * 上半屏：目标旋律线(蓝) + 你的声音轨迹(绿/黄/红)
 * 下半屏：滚动歌词逐字高亮
 * 中层：打分特效弹出
 */
class KaraokeEngine {
  constructor() {
    // 旋律数据 [{time:秒, pitch:Hz, lyricIdx:行号, syllable:"字"}]
    this.melody = [];
    this.userTrace = [];        // [{time, pitch, score}]
    this.isActive = false;
    this.isPaused = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.currentNoteIdx = 0;
    this.currentLyricIdx = -1;
    
    // 打分
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.noteResults = [];      // [{target, actual, label, score}]
    
    // Web Audio 导唱
    this.audioCtx = null;
    this.guideOsc = null;
    this.guideGain = null;
    this.guideActive = false;
    
    // Canvas
    this.canvas = null;
    this.ctx = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    
    // rAF
    this._rafId = null;
    this._lastDrawTime = 0;

    // 节拍轨（鼓机）
    this._beatBpm = 0;
    this._beatInterval = 0;
    this._beatTimer = null;
    this._beatIdx = 0;       // 0=kick,1=snare,2=kick,3=snare (4/4拍)
    this._beatGain = null;
    this._beatOn = true;
    this._nextBeatTime = 0;

    // MP3 伴奏
    this._audio = null;           // HTML Audio element
    this._audioSource = null;     // Web Audio MediaElementSourceNode
    this._hasAudio = false;       // 是否有真实伴奏

    // 回调
    this.onScoreEffect = null;   // ({type, text, combo}) => {}
    this.onLyricChange = null;   // (lyricIdx) => {}
    this.onStatsUpdate = null;   // ({score, combo, perfect, good, miss}) => {}
    this.onComplete = null;      // (result) => {}
  }

  /**
   * 加载旋律数据
   * @param {Array} melodyData - [{time, pitch, lyricIdx, syllable?}]
   * @param {number} totalDuration - 歌曲总秒数
   * @param {number} bpm - 歌曲BPM
   */
  loadMelody(melodyData, totalDuration, bpm) {
    this.melody = melodyData.sort((a,b) => a.time - b.time);
    this.totalDuration = totalDuration || (this.melody.length > 0 ? this.melody[this.melody.length-1].time + 2 : 60);
    this._beatBpm = bpm || 80;
    this._beatInterval = 60 / this._beatBpm;
    this.currentNoteIdx = 0;
    this.currentLyricIdx = -1;
    this.userTrace = [];
    this.noteResults = [];
    this.totalScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
  }

  /**
   * 附加 Canvas 元素
   */
  attachCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resizeCanvas();
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  /**
   * 初始化 Web Audio 导唱
   */
  _initAudio() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.guideGain = this.audioCtx.createGain();
      this.guideGain.gain.value = 0.12;
      this.guideGain.connect(this.audioCtx.destination);
      // 节拍轨增益（独立通道）
      this._beatGain = this.audioCtx.createGain();
      this._beatGain.gain.value = 0.25;
      this._beatGain.connect(this.audioCtx.destination);
    } catch(e) {
      console.warn('Web Audio init failed:', e);
    }
  }

  /**
   * 鼓机：播放单个鼓音色
   * @param {string} type - 'kick' | 'snare' | 'hat'
   */
  _playDrum(type) {
    if (!this.audioCtx || !this._beatGain) return;
    if (!this._beatOn) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    try {
      if (type === 'kick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        gain.gain.setValueAtTime(1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.connect(gain);
        gain.connect(this._beatGain);
        osc.start(t);
        osc.stop(t + 0.2);
      } else if (type === 'snare') {
        // 噪声+正弦混合模拟军鼓
        const bufferSize = ctx.sampleRate * 0.1;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this._beatGain);
        noise.start(t);
        noise.stop(t + 0.1);
        // 叠加低频正弦
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 180;
        oscGain.gain.setValueAtTime(0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
        osc.connect(oscGain);
        oscGain.connect(this._beatGain);
        osc.start(t);
        osc.stop(t + 0.1);
      } else if (type === 'hat') {
        // 短促高频噪声模拟踩镲
        const bufferSize = ctx.sampleRate * 0.05;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 5000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        noise.connect(hp);
        hp.connect(gain);
        gain.connect(this._beatGain);
        noise.start(t);
        noise.stop(t + 0.05);
      }
    } catch(e) { /* ignore */ }
  }

  /**
   * 启动节拍轨
   */
  _startBeatTrack() {
    if (this._beatTimer) return;
    if (this._beatBpm <= 0) return;
    this._beatIdx = 0;
    this._nextBeatTime = this._beatInterval; // 第一个节拍在一拍后
    this._beatTimer = setInterval(() => {
      if (!this.isActive || this.isPaused) return;
      const elapsed = this.getElapsedMs() / 1000;
      // 跳过已过去的节拍
      while (this._nextBeatTime <= elapsed) {
        const beatInBar = this._beatIdx % 4;
        if (beatInBar === 0 || beatInBar === 2) this._playDrum('kick');
        else if (beatInBar === 1 || beatInBar === 3) this._playDrum('snare');
        // 每拍加 hi-hat（8分音符）
        this._playDrum('hat');
        this._beatIdx++;
        this._nextBeatTime += this._beatInterval;
      }
    }, 50);
  }

  _stopBeatTrack() {
    if (this._beatTimer) {
      clearInterval(this._beatTimer);
      this._beatTimer = null;
    }
  }

  /**
   * 设置节拍开关
   */
  setBeatOn(on) {
    this._beatOn = !!on;
  }

  /**
   * 播放导唱音
   */
  _playGuideTone(pitch) {
    if (!this.audioCtx || !this.guideGain) return;
    this._stopGuideTone();
    if (!pitch || pitch < 80 || pitch > 1200) return;
    try {
      this.guideOsc = this.audioCtx.createOscillator();
      this.guideOsc.type = 'sine';
      this.guideOsc.frequency.value = pitch;
      this.guideOsc.connect(this.guideGain);
      this.guideOsc.start();
      this.guideActive = true;
      // 持续0.3秒后渐弱（模拟"叮"的提示音）
      setTimeout(() => {
        if (this.guideOsc) {
          this.guideGain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
        }
      }, 200);
    } catch(e) { /* ignore */ }
  }

  _stopGuideTone() {
    if (this.guideOsc) {
      try { this.guideOsc.stop(); } catch(e) {}
      this.guideOsc.disconnect();
      this.guideOsc = null;
    }
    this.guideActive = false;
    if (this.guideGain) {
      this.guideGain.gain.value = 0.12;
    }
  }

  /**
   * 加载 MP3 伴奏文件
   * @param {string|File} source - URL 或 File 对象
   * @returns {Promise} resolves when loaded
   */
  async loadAudioFile(source) {
    this._stopAudio();
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 0.8;
      if (typeof source === 'string') {
        audio.src = source;
      } else {
        audio.src = URL.createObjectURL(source);
      }
      audio.oncanplaythrough = () => {
        this._audio = audio;
        this._hasAudio = true;
        // 连接到 Web Audio 图（可调音量）
        if (this.audioCtx) {
          try {
            this._audioSource = this.audioCtx.createMediaElementSource(audio);
            const gain = this.audioCtx.createGain();
            gain.gain.value = 0.9;
            this._audioSource.connect(gain);
            gain.connect(this.audioCtx.destination);
          } catch(e) { /* already connected? route directly */ }
        }
        resolve(audio);
      };
      audio.onerror = () => reject(new Error('音频加载失败'));
      audio.load();
      // 超时回退
      setTimeout(() => { if (!this._hasAudio) reject(new Error('加载超时')); }, 10000);
    });
  }

  _stopAudio() {
    if (this._audio) {
      try { this._audio.pause(); } catch(e) {}
      this._audio.currentTime = 0;
      this._audio = null;
    }
    this._audioSource = null;
    this._hasAudio = false;
  }

  /**
   * 开始 K 歌
   */
  start() {
    this._initAudio();
    this._resizeCanvas();
    this.isActive = true;
    this.isPaused = false;
    this.currentNoteIdx = 0;
    this.currentLyricIdx = -1;
    this.userTrace = [];
    this._lastDrawTime = 0;
    // 有 MP3 伴奏 → 用 audio 驱动，关闭节拍
    if (this._hasAudio && this._audio) {
      this._beatOn = false;
      this.startTime = 0; // audio.currentTime 直接当 elapsed
      this.pauseOffset = 0;
      this._audio.currentTime = 0;
      this._audio.play().catch(() => {});
      // 监听结束
      this._audio.onended = () => { if (this.isActive) this.stop(); };
    } else {
      this.startTime = Date.now();
      this.pauseOffset = 0;
      this._startBeatTrack();
    }
    this._drawLoop();
  }

  /**
   * 暂停
   */
  pause() {
    if (!this.isActive) return;
    this.isPaused = true;
    if (this._hasAudio && this._audio) {
      this._audio.pause();
    } else {
      this.pauseOffset += Date.now() - this.startTime;
      this._stopBeatTrack();
    }
    this._stopGuideTone();
  }

  /**
   * 继续
   */
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this._hasAudio && this._audio) {
      this._audio.play().catch(() => {});
    } else {
      this.startTime = Date.now();
      this._nextBeatTime = this.getElapsedMs() / 1000 + this._beatInterval;
      this._startBeatTrack();
    }
  }

  /**
   * 停止
   */
  stop() {
    this.isActive = false;
    this.isPaused = false;
    this._stopGuideTone();
    this._stopBeatTrack();
    this._stopAudio();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    return this._calculateFinalResult();
  }

  /**
   * 获取当前已过时间（毫秒）
   */
  getElapsedMs() {
    if (!this.isActive) return this.pauseOffset;
    if (this.isPaused) return this.pauseOffset;
    if (this._hasAudio && this._audio) {
      return this._audio.currentTime * 1000;
    }
    return Date.now() - this.startTime + this.pauseOffset;
  }

  /**
   * 每帧输入用户音高
   * @param {number} pitch - Hz
   */
  feedPitch(pitch) {
    if (!this.isActive || this.isPaused) return;
    const elapsed = this.getElapsedMs() / 1000;
    
    this.userTrace.push({ time: elapsed, pitch: pitch || 0 });
    // 限制 trace 长度
    if (this.userTrace.length > 600) this.userTrace.shift();

    // 检测当前应评分的音符
    this._checkNoteScoring(elapsed, pitch);
  }

  /**
   * 检测并评分当前音符
   */
  _checkNoteScoring(elapsedSec, userPitch) {
    // 找到第一个时间已过但尚未评分的音符
    while (this.currentNoteIdx < this.melody.length) {
      const note = this.melody[this.currentNoteIdx];
      if (elapsedSec >= note.time) {
        if (userPitch && userPitch > 50) {
          this._scoreNote(note, userPitch);
        } else {
          this._recordMiss(note);
        }
        this.currentNoteIdx++;
      } else {
        break;
      }
    }

    // 检测是否结束
    if (this.currentNoteIdx >= this.melody.length && this.melody.length > 0) {
      // 自动停止
      setTimeout(() => this.stop(), 2000);
    }
  }

  /**
   * 评分单个音符
   */
  _scoreNote(note, userPitch) {
    const target = note.pitch;
    const diff = Math.abs(userPitch - target);
    const diffSemitones = 12 * Math.log2(Math.max(userPitch, 50) / Math.max(target, 50));
    const absDiff = Math.abs(diffSemitones);
    
    let label, type, points;
    if (absDiff <= 0.5) {
      label = '完美!';
      type = 'perfect';
      points = 100;
      this.perfectCount++;
    } else if (absDiff <= 1.0) {
      label = userPitch < target ? '略低 ↑' : '略高 ↓';
      type = 'good';
      points = 70;
      this.goodCount++;
    } else if (absDiff <= 2.0) {
      label = userPitch < target ? '偏低 ↑↑' : '偏高 ↓↓';
      type = 'ok';
      points = 40;
    } else {
      label = userPitch < target ? '太低 ⬆' : '太高 ⬇';
      type = 'miss';
      points = 10;
      this.missCount++;
    }

    // Combo
    if (type === 'perfect' || type === 'good') {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (this.combo > 1) points = Math.floor(points * (1 + this.combo * 0.05));
    } else {
      this.combo = 0;
    }

    this.totalScore += points;
    
    const result = { target, actual: userPitch, label, type, points, combo: this.combo, lyricIdx: note.lyricIdx };
    this.noteResults.push(result);

    // 触发回调
    if (this.onScoreEffect) {
      this.onScoreEffect({ type, text: label, combo: this.combo, points });
    }
    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        score: this.totalScore,
        combo: this.combo,
        perfect: this.perfectCount,
        good: this.goodCount,
        miss: this.missCount
      });
    }
    if (note.lyricIdx !== undefined) {
      if (note.lyricIdx !== this.currentLyricIdx || note.syllableIdx !== this.currentSyllableIdx) {
        this.currentLyricIdx = note.lyricIdx;
        this.currentSyllableIdx = note.syllableIdx || 0;
        if (this.onLyricChange) {
          this.onLyricChange({ lyricIdx: note.lyricIdx, syllableIdx: note.syllableIdx || 0 });
        }
      }
    }

    // 播放导唱音（提前0.3秒播放下一个目标音）
    this._scheduleNextGuide();
  }

  _recordMiss(note) {
    this.missCount++;
    this.combo = 0;
    this.noteResults.push({ target: note.pitch, actual: 0, label: 'miss', type: 'miss', points: 0, combo: 0, lyricIdx: note.lyricIdx });
    if (this.onScoreEffect) {
      this.onScoreEffect({ type: 'miss', text: '', combo: 0, points: 0 });
    }
    this._scheduleNextGuide();
  }

  _scheduleNextGuide() {
    const nextIdx = this.currentNoteIdx + 1;
    if (nextIdx < this.melody.length) {
      // 不在这里播放，而是在音符时间到达时播放
      // 简化：每5个音符播一次导唱
      if (nextIdx % 5 === 0) {
        this._playGuideTone(this.melody[nextIdx].pitch);
      }
    }
  }

  /**
   * 绘制循环
   */
  _drawLoop() {
    if (!this.isActive) return;
    this._drawPitchCanvas();
    this._rafId = requestAnimationFrame(() => this._drawLoop());
  }

  /**
   * 绘制音高对比画布
   */
  _drawPitchCanvas() {
    if (!this.ctx || !this.canvasWidth) return;
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = (h / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    const elapsed = this.getElapsedMs() / 1000;
    const viewWindow = 6; // 显示6秒窗口
    const viewStart = Math.max(0, elapsed - 1); // 用户当前时间偏右
    const viewEnd = viewStart + viewWindow;
    const timeToX = (t) => ((t - viewStart) / viewWindow) * w;
    
    // 音高范围：50-600Hz → 对数映射到画布高度
    const pitchMin = Math.log(50);
    const pitchMax = Math.log(600);
    const pitchRange = pitchMax - pitchMin;
    const pitchToY = (p) => h - ((Math.log(Math.max(p, 50)) - pitchMin) / pitchRange) * h;
    
    // 绘制目标旋律线
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let firstPoint = true;
    for (const note of this.melody) {
      if (note.time < viewStart - 0.5 || note.time > viewEnd + 0.5) continue;
      const x = timeToX(note.time);
      const y = pitchToY(note.pitch);
      if (firstPoint) { ctx.moveTo(x, y); firstPoint = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // 目标音符点
    for (const note of this.melody) {
      if (note.time < viewStart - 0.5 || note.time > viewEnd + 0.5) continue;
      const x = timeToX(note.time);
      const y = pitchToY(note.pitch);
      ctx.fillStyle = '#00b4ff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fill();
    }

    // 绘制用户声音轨迹
    if (this.userTrace.length > 1) {
      ctx.strokeStyle = '#16c79a';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(22, 199, 154, 0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      let firstUser = true;
      for (const pt of this.userTrace) {
        if (pt.time < viewStart - 0.5 || pt.time > viewEnd + 0.5) continue;
        if (pt.pitch < 40) continue;
        const x = timeToX(pt.time);
        const y = pitchToY(pt.pitch);
        if (firstUser) { ctx.moveTo(x, y); firstUser = false; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 当前时间线
    const nowX = timeToX(elapsed);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(nowX, 0);
    ctx.lineTo(nowX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 轴标签
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    for (let p = 100; p <= 500; p += 100) {
      ctx.fillText(p + 'Hz', 4, pitchToY(p) - 2);
    }
    
    // 音符标签
    ctx.fillStyle = 'rgba(0,180,255,0.6)';
    ctx.font = 'bold 9px monospace';
    const noteNames = ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5'];
    const noteHz = [131,147,165,175,196,220,247,262,294,330,349,392,440,494,523];
    for (let i = 0; i < noteHz.length; i++) {
      const y = pitchToY(noteHz[i]);
      if (y > 10 && y < h - 10) {
        ctx.fillText(noteNames[i], w - 30, y + 3);
      }
    }
  }

  /**
   * 计算最终结果
   */
  _calculateFinalResult() {
    const total = this.perfectCount + this.goodCount + this.missCount + 
                  (this.noteResults.length - this.perfectCount - this.goodCount - this.missCount);
    const maxScore = this.melody.length * 100;
    const pct = maxScore > 0 ? Math.round((this.totalScore / maxScore) * 100) : 0;
    
    return {
      score: this.totalScore,
      maxScore,
      pct,
      perfect: this.perfectCount,
      good: this.goodCount,
      miss: this.missCount,
      maxCombo: this.maxCombo,
      totalNotes: this.melody.length,
      noteResults: this.noteResults,
      userTrace: this.userTrace
    };
  }
}

window.KaraokeEngine = KaraokeEngine;
