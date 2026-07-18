/**
 * 专属教练记忆系统 — Personal Voice Coach with Memory
 * 
 * 核心能力：
 * 1. 记录每次练习的详细数据（不仅分数，还有模式特征）
 * 2. 识别薄弱点（哪些音高总掉、哪类共鸣上不去）
 * 3. 根据历史生成今日推荐训练计划
 * 4. 调用豆包API生成个性化分析建议
 */
class PersonalCoach {
  constructor(storage, doubaoAPI) {
    this.storage = storage;
    this.doubaoAPI = doubaoAPI;
    this.memory = storage.getCoachMemory();
  }

  /**
   * 练习完成后调用：记录详细数据并更新分析
   */
  recordSession(sessionData) {
    // 1. 保存详细记录
    this.storage.addDetailedSession(sessionData);
    
    // 2. 更新薄弱点分析
    this.analyzeWeakness(sessionData);
    
    // 3. 更新趋势数据
    this.updateTrend(sessionData);
    
    // 4. 生成今日推荐
    this.generateRecommendation();
  }

  /**
   * 分析本次练习的薄弱点
   */
  analyzeWeakness(session) {
    const profile = this.memory.weaknessProfile;
    const weakSpots = [];
    
    // 音高分析
    if (session.type === 'pitch' || session.type === 'resonance') {
      if (session.avgPitch && session.targetPitch) {
        const pitchDiff = session.avgPitch - session.targetPitch;
        if (Math.abs(pitchDiff) > 15) {
          weakSpots.push(pitchDiff > 0 ? 'pitch_too_high' : 'pitch_too_low');
        }
      }
      if (session.pitchStdDev && session.pitchStdDev > 10) {
        weakSpots.push('pitch_unstable');
      }
    }
    
    // 共鸣分析
    if (session.resonanceRatio != null) {
      if (session.resonanceRatio < 0.3) {
        weakSpots.push('resonance_chest_dominant');
      } else if (session.resonanceRatio > 0.7) {
        weakSpots.push('resonance_head_dominant');
      }
    }
    if (session.resonanceStability != null && session.resonanceStability > 15) {
      weakSpots.push('resonance_unstable');
    }
    
    // 更新频率统计
    const pitchDropCount = weakSpots.filter(s => s === 'pitch_too_low').length;
    if (pitchDropCount > 0) {
      const oldRate = profile.pitchDropRate || 0;
      profile.pitchDropRate = Math.min(1, oldRate + 0.1);
    } else {
      profile.pitchDropRate = Math.max(0, (profile.pitchDropRate || 0) - 0.05);
    }
    
    // 共鸣主导趋势
    if (session.resonanceRatio != null) {
      if (session.resonanceRatio < 0.35) profile.resonanceDominance = 'chest';
      else if (session.resonanceRatio > 0.55) profile.resonanceDominance = 'head';
      else profile.resonanceDominance = 'balanced';
    }
    
    profile.stabilityIssue = weakSpots.includes('pitch_unstable') || weakSpots.includes('resonance_unstable');
    
    // 更新过渡薄弱点
    if (session.transitionIssues && session.transitionIssues.length > 0) {
      session.transitionIssues.forEach(issue => {
        if (!profile.transitionWeakness.includes(issue)) {
          profile.transitionWeakness.push(issue);
        }
      });
    }
    
    profile.lastAnalysis = new Date().toISOString();
    this.storage.updateWeaknessProfile(profile);
    
    return weakSpots;
  }

  /**
   * 更新长期趋势
   */
  updateTrend(session) {
    const trend = this.memory.trend;
    
    // 音高趋势（最近20次）
    if (session.avgPitch) {
      trend.pitchTrend.push({
        value: session.avgPitch,
        date: new Date().toISOString(),
        type: session.type
      });
      if (trend.pitchTrend.length > 20) trend.pitchTrend.shift();
    }
    
    // 共鸣趋势
    if (session.resonanceRatio != null) {
      trend.resonanceTrend.push({
        value: session.resonanceRatio,
        pct: session.resonanceRatio * 100,
        date: new Date().toISOString(),
        type: session.type
      });
      if (trend.resonanceTrend.length > 20) trend.resonanceTrend.shift();
    }
    
    // 判断趋势方向
    if (trend.pitchTrend.length >= 5) {
      const recent = trend.pitchTrend.slice(-5).map(t => t.value);
      const older = trend.pitchTrend.slice(-10, -5).map(t => t.value);
      if (older.length >= 3 && recent.length >= 3) {
        const recentAvg = recent.reduce((a,b) => a+b, 0) / recent.length;
        const olderAvg = older.reduce((a,b) => a+b, 0) / older.length;
        const diff = recentAvg - olderAvg;
        if (diff > 5) trend.direction = 'improving';
        else if (diff < -5) trend.direction = 'declining';
        else trend.direction = 'plateau';
      }
    }
    
    this.storage.updateTrend(trend);
  }

  /**
   * 根据历史生成今日推荐
   */
  generateRecommendation() {
    const profile = this.memory.weaknessProfile;
    const rec = { generatedAt: new Date().toISOString() };
    
    // 判断训练重点
    if (profile.resonanceDominance === 'chest') {
      rec.focus = 'resonance';
      rec.warmup = '做2分钟"无声K"喉位练习，感受喉结上提';
      rec.exercise = '进入共鸣训练练习模式，专注头腔共鸣（想象声音从眉心发出）';
      rec.goal = '共鸣比达到55%以上（头腔主导）';
    } else if (profile.pitchDropRate > 0.3) {
      rec.focus = 'pitch';
      rec.warmup = '哼鸣热身：从C3到G3慢速上行，感受声带拉长';
      rec.exercise = '进入音高测试模式，专注保持音高在150Hz以上';
      rec.goal = '音高稳定性 <10Hz（标准差）';
    } else if (profile.stabilityIssue) {
      rec.focus = 'stability';
      rec.warmup = '腹式呼吸放松，用"嘶"声缓慢呼气30秒';
      rec.exercise = '进入句子跟读练习模式';
      rec.goal = '旋律稳定性 <12Hz';
    } else {
      rec.focus = 'mixed';
      rec.warmup = '2分钟综合热身（哼鸣+无声K+腹式呼吸）';
      rec.exercise = '自由练习，选择你最想提升的部分';
      rec.goal = '保持良好状态，尝试挑战更高难度';
    }
    
    // 添加进度提示
    const trend = this.memory.trend;
    if (trend.direction === 'improving') {
      rec.encouragement = '你最近在持续进步！保持这个节奏 🔥';
    } else if (trend.direction === 'plateau') {
      rec.encouragement = '最近处于平台期，换个训练方式试试突破 💪';
    } else if (trend.direction === 'declining') {
      rec.encouragement = '状态有波动很正常，今天就做一次轻松的恢复练习 🧘';
    } else {
      rec.encouragement = '欢迎开始你的嗓音训练之旅！循序渐进最重要 🌟';
    }
    
    this.storage.updateTodayRecommendation(rec);
    return rec;
  }

  /**
   * 获取训练建议（供AI教练使用）
   */
  getCoachingContext() {
    const profile = this.memory.weaknessProfile;
    const trend = this.memory.trend;
    const rec = this.memory.todayRecommendation;
    
    let context = '【学员当前状态】\n';
    
    if (profile.resonanceDominance === 'chest') {
      context += '· 共鸣偏向胸腔，需要加强头腔共鸣训练\n';
    } else if (profile.resonanceDominance === 'head') {
      context += '· 头腔共鸣良好，可以维持\n';
    } else {
      context += '· 共鸣均衡，状态不错\n';
    }
    
    if (profile.pitchDropRate > 0.3) {
      context += '· 音高偏低频率较高，需要注意保持喉结上提\n';
    }
    
    if (profile.stabilityIssue) {
      context += '· 稳定性需要加强，建议放慢速度练习\n';
    }
    
    if (profile.transitionWeakness.length > 0) {
      context += '· 过渡薄弱点：' + profile.transitionWeakness.join('、') + '\n';
    }
    
    context += `\n【进步趋势】${trend.direction === 'improving' ? '持续进步 📈' : trend.direction === 'plateau' ? '平台期 📊' : trend.direction === 'declining' ? '波动期 📉' : '刚开始 🌱'}\n`;
    
    const sessions = this.storage.getDetailedSessions(1);
    if (sessions.length > 0) {
      context += `\n【上次训练】${new Date(sessions[0].timestamp).toLocaleDateString('zh-CN')} - ${sessions[0].type}练习\n`;
    }
    
    return context;
  }

  /**
   * 获取薄弱点中文描述
   */
  getWeaknessLabels(weakSpots) {
    const labels = {
      'pitch_too_high': '音高偏高',
      'pitch_too_low': '音高偏低',
      'pitch_unstable': '音高不稳定',
      'resonance_chest_dominant': '胸腔共鸣主导',
      'resonance_head_dominant': '头腔共鸣过度',
      'resonance_unstable': '共鸣不稳定'
    };
    return (weakSpots || []).map(s => labels[s] || s);
  }

  /**
   * 获取嗓音总评分（基于完整数据分析）
   */
  getOverallScore() {
    const profile = this.memory.weaknessProfile;
    const trend = this.memory.trend;
    
    let score = 50; // 基础分
    
    // 共鸣加分
    if (profile.resonanceDominance === 'head') score += 20;
    else if (profile.resonanceDominance === 'balanced') score += 10;
    
    // 稳定性加分
    if (!profile.stabilityIssue) score += 10;
    
    // 音高加分
    if (profile.pitchDropRate < 0.2) score += 10;
    
    // 趋势加分
    if (trend.direction === 'improving') score += 10;
    else if (trend.direction === 'plateau') score += 0;
    else if (trend.direction === 'declining') score -= 10;
    
    // 练习量加分
    const sessions = this.memory.detailedSessions;
    if (sessions.length >= 30) score += 10;
    else if (sessions.length >= 10) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 获取阶段标签
   */
  getStageLabel(score) {
    if (score < 30) return { label: '初学阶段', color: '#e94560', icon: '🌱' };
    if (score < 50) return { label: '基础建立', color: '#ffa502', icon: '🌿' };
    if (score < 70) return { label: '进阶中', color: '#00d9ff', icon: '🌳' };
    if (score < 85) return { label: '接近目标', color: '#16c79a', icon: '🎯' };
    return { label: '女声达成！', color: '#ffd700', icon: '👑' };
  }
}

window.PersonalCoach = PersonalCoach;
