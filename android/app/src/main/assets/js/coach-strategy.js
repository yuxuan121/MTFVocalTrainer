/**
 * CoachStrategy - 本地规则引擎（策略层核心）
 * 
 * 职责：接收音高数据 → 判定训练状态 → 输出结构化指令
 * 大模型只负责把指令润色成自然话术，不参与决策
 * 
 * 离线可用，完全不依赖网络
 */
class CoachStrategy {
  constructor() {
    // 可配置阈值
    this.config = {
      // 音准判定（Hz偏差）
      perfectThreshold: 5,
      goodThreshold: 15,
      warnThreshold: 30,

      // 尾音稳定（末尾2秒波动 Hz）
      stableThreshold: 5,

      // 稳频计数
      streakForUpgrade: 3,
      streakForRest: 5,   // 连续下滑多少次建议休息

      // 目标区间（根据阶段动态调整）
      targetMin: 140,
      targetMax: 170,
    };

    // 状态
    this._streak = 0;            // 连续稳频次数
    this._declineStreak = 0;     // 连续下滑次数
    this._lastFreq = 0;
    this._currentStage = 'beginner';  // beginner | intermediate | advanced
    this._subLevel = 1;          // 1-5
    this._totalSessions = 0;
  }

  /**
   * 设置训练阶段（影响目标区间）
   */
  setStage(stage, subLevel) {
    this._currentStage = stage;
    this._subLevel = subLevel || 1;
    const ranges = {
      beginner:    [140, 170],
      intermediate:[170, 200],
      advanced:    [200, 240]
    };
    const range = ranges[stage] || ranges.beginner;
    // 子阶微调：每个子阶推进 6Hz
    const step = (subLevel - 1) * 6;
    this.config.targetMin = range[0] + step;
    this.config.targetMax = Math.min(range[1] + step, 260);
  }

  /**
   * 核心方法：输入音高数据，输出训练指令
   * @param {Object} voiceData - { freq, stability, voiceDuration, isSilent }
   * @returns {Object} { action, severity, params }
   *   action: 'praise_stable' | 'hint_raise' | 'hint_lower' | 
   *           'ready_upgrade' | 'need_rest' | 'no_voice' | 'idle'
   */
  evaluate(voiceData) {
    const { freq, stability, isSilent } = voiceData;

    // 无声音
    if (isSilent || !freq || freq <= 0) {
      return { action: 'no_voice', severity: 'info', params: {} };
    }

    const { targetMin, targetMax, stableThreshold } = this.config;
    const mid = (targetMin + targetMax) / 2;
    const deviation = freq - mid;
    const absDev = Math.abs(deviation);

    // === 判定音准 ===
    let pitchAction;
    if (absDev <= this.config.perfectThreshold) {
      pitchAction = 'perfect';
    } else if (absDev <= this.config.goodThreshold) {
      pitchAction = 'good';
    } else if (absDev <= this.config.warnThreshold) {
      pitchAction = 'warn';
    } else {
      pitchAction = 'off';
    }

    // === 判定稳定度 ===
    const isStable = stability !== undefined && stability <= stableThreshold;

    // === 更新 streak ===
    if (isStable && (pitchAction === 'perfect' || pitchAction === 'good')) {
      this._streak++;
      this._declineStreak = 0;
    } else if (pitchAction === 'off') {
      this._declineStreak++;
      this._streak = Math.max(0, this._streak - 1);
    } else {
      this._streak = Math.max(0, this._streak - 1);
      this._declineStreak = 0;
    }

    this._lastFreq = freq;

    // === 生成最终指令 ===
    let action, severity;

    if (this._streak >= this.config.streakForUpgrade) {
      action = 'ready_upgrade';
      severity = 'success';
    } else if (this._declineStreak >= this.config.streakForRest) {
      action = 'need_rest';
      severity = 'warn';
    } else if (isStable && pitchAction === 'perfect') {
      action = 'praise_stable';
      severity = 'success';
    } else if (isStable && pitchAction === 'good') {
      action = 'praise_stable';
      severity = 'info';
    } else if (pitchAction === 'off') {
      action = deviation < 0 ? 'hint_raise' : 'hint_lower';
      severity = 'warn';
    } else if (pitchAction === 'warn') {
      action = deviation < 0 ? 'hint_raise' : 'hint_lower';
      severity = 'info';
    } else {
      action = 'idle';
      severity = 'info';
    }

    return {
      action,
      severity,
      params: {
        freq: Math.round(freq),
        deviation: Math.round(deviation),
        stability: stability ? Math.round(stability * 10) / 10 : 0,
        streak: this._streak,
        targetMin,
        targetMax,
        stage: this._currentStage,
        subLevel: this._subLevel
      }
    };
  }

  /**
   * 检查是否应该升级阶段
   * @returns {boolean}
   */
  shouldUpgrade() {
    return this._streak >= this.config.streakForUpgrade;
  }

  /**
   * 执行升级
   * @returns {{ stage, subLevel }}
   */
  upgrade() {
    this._subLevel++;
    if (this._subLevel > 5) {
      const stages = ['beginner', 'intermediate', 'advanced'];
      const idx = stages.indexOf(this._currentStage);
      if (idx < stages.length - 1) {
        this._currentStage = stages[idx + 1];
        this._subLevel = 1;
      } else {
        this._subLevel = 5; // 最高阶顶点
      }
    }
    this.setStage(this._currentStage, this._subLevel);
    this._streak = 0;
    return { stage: this._currentStage, subLevel: this._subLevel };
  }

  /**
   * 重置当前会话的计数
   */
  resetSession() {
    this._streak = 0;
    this._declineStreak = 0;
  }

  /**
   * 获取当前训练状态摘要
   */
  getStatus() {
    return {
      stage: this._currentStage,
      subLevel: this._subLevel,
      targetMin: this.config.targetMin,
      targetMax: this.config.targetMax,
      streak: this._streak,
      declineStreak: this._declineStreak,
      lastFreq: this._lastFreq
    };
  }
}

window.CoachStrategy = CoachStrategy;
