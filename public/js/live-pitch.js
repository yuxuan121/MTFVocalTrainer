/**
 * LivePitchMonitor - 实时基频显示器（MVP核心）
 * 复用 AudioManager + PitchDetector 管线
 * 
 * 功能：
 *   - 实时频率数字 + 颜色编码（绿/黄/红）
 *   - 30秒滚动频率曲线
 *   - 尾音稳定性检测（语句末2秒波动 < ±5Hz）
 *   - 会话统计（平均频率、稳频比例）
 */
class LivePitchMonitor {
  constructor(audioManager, pitchDetector) {
    this.am = audioManager;
    this.pd = pitchDetector;
    this.isRunning = false;
    this._rafId = null;

    // 画布
    this._canvas = null;
    this._ctx = null;

    // 频率历史（用于曲线图，每100ms一个点）
    this._freqHistory = [];     // [{time, freq}]
    this._maxHistorySec = 30;

    // 尾音检测状态
    this._voiceActive = false;          // 当前是否在说话
    this._voiceEndTime = 0;             // 声音结束时刻
    this._tailSamples = [];             // 尾音期间的频率采样
    this._tailCheckWindow = 2000;       // 尾音检测窗口 2秒
    this._tailStable = false;           // 尾音是否稳定
    this._silenceThreshold = 0.01;      // RMS低于此值视为静音

    // 会话统计
    this._sessionStart = 0;
    this._totalSpeakTime = 0;           // 总说话时长(ms)
    this._stableTailCount = 0;          // 稳定尾音次数
    this._totalTailCount = 0;           // 总尾音检测次数

    // 回调
    this.onUpdate = null;       // (state) => {}  实时状态回调
    this.onTailStable = null;   // (freq) => {}   尾音稳定回调
    this.onVoiceStart = null;   // () => {}       开始说话
    this.onVoiceEnd = null;     // (freq) => {}   停止说话

    // 目标区间
    this.targetMin = 160;
    this.targetMax = 240;
  }

  /**
   * 绑定画布元素
   */
  attachCanvas(canvasEl) {
    this._canvas = canvasEl;
    this._ctx = canvasEl.getContext('2d');
  }

  /**
   * 设置目标频率区间
   */
  setTarget(minHz, maxHz) {
    this.targetMin = minHz;
    this.targetMax = maxHz;
  }

  /**
   * 启动实时监听
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._sessionStart = Date.now();
    this._freqHistory = [];
    this._tailSamples = [];
    this._voiceActive = false;
    this._tailStable = false;
    this._totalSpeakTime = 0;
    this._stableTailCount = 0;
    this._totalTailCount = 0;

    // 复用现有 AudioManager 的录制管线
    this.am.startRecording((audioData) => {
      if (!this.isRunning) return;
      this._processAudioFrame(audioData);
    });

    this._drawLoop();
  }

  /**
   * 停止监听
   */
  stop() {
    this.isRunning = false;
    this.am.stopRecording();
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    return this._getSessionStats();
  }

  // ===== 内部方法 =====

  _processAudioFrame(audioData) {
    const pitch = this.pd.detectPitch(audioData.timeDomainData);
    const now = Date.now();
    const rms = this._calcRMS(audioData.timeDomainData);

    if (pitch && rms > this._silenceThreshold) {
      // 正在发声
      if (!this._voiceActive) {
        this._voiceActive = true;
        this._tailSamples = [];
        if (this.onVoiceStart) this.onVoiceStart();
      }
      this._tailSamples.push({ freq: pitch, time: now });

      // 添加到历史曲线（每100ms采样一次以减少数据量）
      const lastPt = this._freqHistory[this._freqHistory.length - 1];
      if (!lastPt || (now - lastPt.time) > 100) {
        this._freqHistory.push({ time: now, freq: pitch });
        // 裁剪历史
        const cutoff = now - this._maxHistorySec * 1000;
        while (this._freqHistory.length > 0 && this._freqHistory[0].time < cutoff) {
          this._freqHistory.shift();
        }
      }
    } else {
      // 静音
      if (this._voiceActive) {
        const silentDuration = now - (this._tailSamples.length > 0
          ? this._tailSamples[this._tailSamples.length - 1].time : now);

        if (silentDuration > 300) { // 300ms连续静音=判定为语句结束
          this._voiceActive = false;
          this._voiceEndTime = now;
          this._totalTailCount++;
          this._checkTailStability();
          if (this.onVoiceEnd) {
            const avgFreq = this._tailSamples.length > 0
              ? this._tailSamples.reduce((s, t) => s + t.freq, 0) / this._tailSamples.length
              : 0;
            this.onVoiceEnd(avgFreq);
          }
        }
      }
    }
  }

  _checkTailStability() {
    // 取尾音窗口内的样本
    const now = Date.now();
    const cutoff = now - this._tailCheckWindow;
    const tailWindow = this._tailSamples.filter(s => s.time >= cutoff);

    if (tailWindow.length < 5) {
      this._tailStable = false;
      return;
    }

    const freqs = tailWindow.map(s => s.freq);
    const avg = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    const maxDev = Math.max(...freqs.map(f => Math.abs(f - avg)));

    this._tailStable = maxDev <= 5; // ±5Hz以内算稳定

    if (this._tailStable && this.onTailStable) {
      this._stableTailCount++;
      this.onTailStable(avg);
    }
  }

  _calcRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  _drawLoop() {
    if (!this.isRunning) return;
    this._rafId = requestAnimationFrame(() => this._drawLoop());
    if (!this._canvas || !this._ctx) return;
    this._render();
  }

  _render() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    // 获取当前频率
    const avgPitch = this.pd.getAveragePitch(5);
    const freq = avgPitch || 0;

    // --- 背景 ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // --- 频率数字（大字） ---
    const freqText = freq > 0 ? `${Math.round(freq)} Hz` : '-- Hz';
    const freqFontSize = Math.min(w * 0.18, 72);
    ctx.font = `bold ${freqFontSize}px "SF Mono", "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';

    // 颜色编码
    let freqColor;
    if (freq === 0) {
      freqColor = '#666';
    } else if (freq >= this.targetMin && freq <= this.targetMax) {
      freqColor = '#00ff88'; // 绿：目标区间
    } else if (freq >= this.targetMin - 20 && freq <= this.targetMax + 20) {
      freqColor = '#ffcc00'; // 黄：接近
    } else {
      freqColor = '#ff4466'; // 红：偏离
    }

    ctx.fillStyle = freqColor;
    ctx.shadowColor = freqColor;
    ctx.shadowBlur = freq > 0 ? 20 : 0;
    ctx.fillText(freqText, w / 2, h * 0.25);

    // --- 尾音状态标记 ---
    ctx.shadowBlur = 0;
    if (this._voiceActive) {
      // 说话中
      const dotSize = 10;
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(w / 2 + freqFontSize * 1.5, h * 0.25 - freqFontSize * 0.3, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('说话中', w / 2 + freqFontSize * 1.5 + 20, h * 0.25 - freqFontSize * 0.3 + 5);
    } else if (this._tailStable && this._freqHistory.length > 0) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('稳住了 ✓', w / 2 + freqFontSize * 1.5, h * 0.25 - freqFontSize * 0.3 + 5);
    }

    // --- 频率曲线图 ---
    this._drawFreqCurve(ctx, w, h);

    // --- 底部统计条 ---
    this._drawStatsBar(ctx, w, h, freq);
  }

  _drawFreqCurve(ctx, w, h) {
    const margin = { top: h * 0.32, bottom: h * 0.85, left: 30, right: 20 };
    const graphW = w - margin.left - margin.right;
    const graphH = margin.bottom - margin.top;

    // 画布区域
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left, margin.top, graphW, graphH);

    // 目标区间阴影
    const yMin = this.targetMin;
    const yMax = this.targetMax;
    const yRange = 400; // 显示范围: 60-460Hz

    const yToPixel = (freq) => {
      const ratio = Math.max(0, Math.min(1, (freq - 60) / yRange));
      return margin.top + graphH * (1 - ratio);
    };

    // 目标区间填充
    const tTop = yToPixel(yMax);
    const tBot = yToPixel(yMin);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.07)';
    ctx.fillRect(margin.left, tTop, graphW, tBot - tTop);

    // 目标线标注
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, tTop);
    ctx.lineTo(margin.left + graphW, tTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin.left, tBot);
    ctx.lineTo(margin.left + graphW, tBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // 标注文字
    ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${yMax}Hz`, margin.left - 5, tTop + 4);
    ctx.fillText(`${yMin}Hz`, margin.left - 5, tBot + 4);

    // 绘制曲线
    if (this._freqHistory.length < 2) return;
    const now = Date.now();
    const xCutoff = now - this._maxHistorySec * 1000;

    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    let firstPt = true;
    for (const pt of this._freqHistory) {
      if (pt.time < xCutoff) continue;
      const x = margin.left + graphW * ((pt.time - xCutoff) / (this._maxHistorySec * 1000));
      const y = yToPixel(pt.freq);
      if (firstPt) {
        ctx.moveTo(x, y);
        firstPt = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _drawStatsBar(ctx, w, h, freq) {
    const barY = h * 0.88;
    const stats = this._getSessionStats();

    ctx.fillStyle = '#333';
    ctx.fillRect(0, barY, w, h - barY);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';

    const parts = [
      `平均: ${stats.avgFreq} Hz`,
      `稳频: ${stats.stableRatio}%`,
      `尾音稳: ${stats.stableTails}/${stats.totalTails}`,
      `时长: ${stats.duration}`
    ];

    const spacing = w / parts.length;
    parts.forEach((text, i) => {
      ctx.fillText(text, 15 + i * spacing, barY + (h - barY) / 2 + 5);
    });
  }

  _getSessionStats() {
    const duration = this._sessionStart
      ? Math.floor((Date.now() - this._sessionStart) / 1000)
      : 0;

    let avgFreq = 0;
    if (this._freqHistory.length > 0) {
      avgFreq = Math.round(
        this._freqHistory.reduce((s, p) => s + p.freq, 0) / this._freqHistory.length
      );
    }

    const stableRatio = this._totalTailCount > 0
      ? Math.round((this._stableTailCount / this._totalTailCount) * 100)
      : 0;

    const fmtDuration = duration >= 60
      ? `${Math.floor(duration / 60)}分${duration % 60}秒`
      : `${duration}秒`;

    return {
      avgFreq,
      stableRatio,
      stableTails: this._stableTailCount,
      totalTails: this._totalTailCount,
      duration: fmtDuration,
      durationSec: duration
    };
  }
}

window.LivePitchMonitor = LivePitchMonitor;
