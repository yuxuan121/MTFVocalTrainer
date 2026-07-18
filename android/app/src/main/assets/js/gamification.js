/**
 * Gamification system for achievements, scoring, and progression
 */
class Gamification {
  constructor(storage) {
    this.storage = storage;
    this.achievements = this.defineAchievements();
  }

  defineAchievements() {
    return {
      firstSteps: {
        id: 'firstSteps',
        name: 'First Steps',
        description: 'Complete your first exercise',
        icon: '👣',
        xpReward: 10
      },
      pitchPerfect: {
        id: 'pitchPerfect',
        name: 'Pitch Perfect',
        description: 'Hit target within 1Hz',
        icon: '🎯',
        xpReward: 50
      },
      rockSolid: {
        id: 'rockSolid',
        name: 'Rock Solid',
        description: 'Sustain for 30s with <5Hz std dev',
        icon: '💎',
        xpReward: 100
      },
      resonanceMaster: {
        id: 'resonanceMaster',
        name: 'Resonance Master',
        description: 'Complete Section II',
        icon: '🔮',
        xpReward: 150
      },
      wordWizard: {
        id: 'wordWizard',
        name: 'Word Wizard',
        description: 'Master 50 words',
        icon: '📖',
        xpReward: 200
      },
      consistent7: {
        id: 'consistent7',
        name: 'Week Warrior',
        description: '7 day streak',
        icon: '🔥',
        xpReward: 75
      },
      consistent30: {
        id: 'consistent30',
        name: 'Monthly Master',
        description: '30 day streak',
        icon: '⭐',
        xpReward: 250
      },
      consistent100: {
        id: 'consistent100',
        name: 'Century Champion',
        description: '100 day streak',
        icon: '👑',
        xpReward: 500
      },
      overachiever: {
        id: 'overachiever',
        name: 'Overachiever',
        description: 'Practice 30 days in a month',
        icon: '🏆',
        xpReward: 300
      },
      earlyBird: {
        id: 'earlyBird',
        name: 'Early Bird',
        description: 'Practice 5 days in a row',
        icon: '🐦',
        xpReward: 50
      },
      nightOwl: {
        id: 'nightOwl',
        name: 'Night Owl',
        description: 'Practice at night (after 10 PM)',
        icon: '🦉',
        xpReward: 25
      },
      marathoner: {
        id: 'marathoner',
        name: 'Marathoner',
        description: 'Practice for 60 minutes in one session',
        icon: '🏃',
        xpReward: 100
      },
      vowelVirtuoso: {
        id: 'vowelVirtuoso',
        name: 'Vowel Virtuoso',
        description: 'Master all vowels',
        icon: '🎵',
        xpReward: 75
      },
      phrasePhenom: {
        id: 'phrasePhenom',
        name: 'Phrase Phenom',
        description: 'Master 25 phrases',
        icon: '💬',
        xpReward: 150
      },
      speedster: {
        id: 'speedster',
        name: 'Speedster',
        description: 'Hit target pitch in under 1 second',
        icon: '⚡',
        xpReward: 50
      }
    };
  }

  checkAchievement(achievementId, condition = true) {
    if (!condition) return null;

    const achievement = this.achievements[achievementId];
    if (!achievement) return null;

    const unlocked = this.storage.unlockAchievement(achievementId);
    if (unlocked) {
      this.storage.addXP(achievement.xpReward);
      return achievement;
    }
    return null;
  }

  checkStreakAchievements() {
    const gamification = this.storage.getGamification();
    const streak = gamification.streak;

    const achievements = [];

    if (streak >= 100) {
      const a = this.checkAchievement('consistent100');
      if (a) achievements.push(a);
    } else if (streak >= 30) {
      const a = this.checkAchievement('consistent30');
      if (a) achievements.push(a);
    } else if (streak >= 7) {
      const a = this.checkAchievement('consistent7');
      if (a) achievements.push(a);
    } else if (streak >= 5) {
      const a = this.checkAchievement('earlyBird');
      if (a) achievements.push(a);
    }

    return achievements;
  }

  checkMonthlyAchievement() {
    const gamification = this.storage.getGamification();
    const dailyMinutes = gamification.dailyPracticeMinutes;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let daysInMonth = 0;
    for (const dateStr in dailyMinutes) {
      const date = new Date(dateStr);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        daysInMonth++;
      }
    }

    if (daysInMonth >= 30) {
      return this.checkAchievement('overachiever');
    }
    return null;
  }

  calculatePitchScore(targetFreq, actualFreq, timeToHit, sustainDuration, stdDev) {
    let score = 0;

    // Accuracy score (max 100 points)
    const accuracyError = Math.abs(targetFreq - actualFreq);
    const accuracyScore = Math.max(0, 100 - (accuracyError * 10));
    score += accuracyScore;

    // Speed bonus (max 50 points)
    const speedScore = Math.max(0, 50 - (timeToHit * 10));
    score += speedScore;

    // Sustain score (max 100 points)
    const sustainScore = Math.min(100, (sustainDuration / 30) * 100);
    score += sustainScore;

    // Stability score (max 100 points)
    const stabilityScore = Math.max(0, 100 - (stdDev * 10));
    score += stabilityScore;

    // Total max: 350 points
    return Math.round(score);
  }

  calculateResonanceScore(formantStability, targetStability = 10) {
    // Lower stability (std dev) is better
    const score = Math.max(0, 100 - ((formantStability / targetStability) * 100));
    return Math.round(score);
  }

  calculateWordScore(pitchStdDev, resonanceStdDev) {
    const pitchScore = Math.max(0, 100 - (pitchStdDev * 10));
    const resonanceScore = Math.max(0, 100 - (resonanceStdDev * 10));
    return Math.round((pitchScore + resonanceScore) / 2);
  }

  awardXP(section, score) {
    // Base XP from score
    let xp = Math.floor(score / 10);

    // Section multiplier
    if (section === 1) xp *= 1;
    else if (section === 2) xp *= 1.5;
    else if (section === 3) xp *= 2;

    // Add daily login bonus (10 XP)
    const gamification = this.storage.getGamification();
    const today = new Date().toDateString();
    if (gamification.lastPracticeDate !== today) {
      xp += 10;
    }

    const result = this.storage.addXP(xp);
    return result;
  }

  getProgressToNextLevel() {
    const gamification = this.storage.getGamification();
    const xpPerLevel = 100;
    const progress = (gamification.xp / xpPerLevel) * 100;
    return {
      currentXP: gamification.xp,
      xpNeeded: xpPerLevel,
      percentage: Math.round(progress)
    };
  }

  getUnlockedAchievements() {
    const gamification = this.storage.getGamification();
    return gamification.achievements.map(id => this.achievements[id]).filter(a => a);
  }

  getAllAchievements() {
    return Object.values(this.achievements);
  }

  getStreakInfo() {
    const gamification = this.storage.getGamification();
    return {
      current: gamification.streak,
      longest: gamification.longestStreak,
      freezes: gamification.streakFreezes,
      multiplier: this.storage.getStreakMultiplier(gamification.streak)
    };
  }
}

// Export for use in other modules
window.Gamification = Gamification;
