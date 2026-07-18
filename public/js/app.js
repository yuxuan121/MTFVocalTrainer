/**
 * Main Application Controller
 */
class VoiceTrainerApp {
  constructor() {
    this.storage = new Storage();
    this.gamification = new Gamification(this.storage);
    this.audioManager = new AudioManager();
    this.pitchDetector = null;
    this.formantAnalyzer = null;
    this.charts = new Charts();
    this.songTrainer = new SongTrainer();
    this.aiCoach = new AICoach();
    this.convCoach = new ConversationCoach();
    this.voiceStudio = new VoiceStudio();
    this.lrcPlayer = new LRCPlayer();
    this.karaoke = new KaraokeEngine();
    this._karaokeGuideOn = true;
    this._karaokeBeatOn = true;
    this.liveMonitor = null;
    this._convMode = 'd1';    // 'd1'|'d2'|'d3'|'free'
    this.coachStrategy = new CoachStrategy();
    this.doubaoAPI = new DoubaoAPI();
    this._freeChatMsgs = [];  // 自由对话消息缓存

    // Exercise state
    this.currentExercise = null;
    this.exerciseStartTime = null;
    this.exerciseData = [];
    this.resonanceHistory = [];

    // Section 2: Advanced Pitch Practice sentences
    this.sentences = [
      // Tier 1: High Vowel Anchors (Easiest)
      { text: "My dearest friend, say hi to me.", tier: 1 },
      { text: "We need three easy keys, please.", tier: 1 },
      // Tier 2: Transitional Vowel Challenges (Medium)
      { text: "Oh, I know all you told me.", tier: 2 },
      { text: "Love you so much, dear.", tier: 2 },
      // Tier 3: Low Consonant Resistance (Hard)
      { text: "Little lamps light up the room.", tier: 3 },
      { text: "No, my name is Ellie, not him.", tier: 3 }
    ];
    this.currentSentenceIndex = 0;
    this.isTestMode = false;
    this.testSentencesCompleted = [];

    // Word practice
    this.vowels = ['A', 'E', 'I', 'O', 'U'];
    this.words = ['hello', 'water', 'sister', 'mother', 'beautiful', 'amazing', 'wonderful', 'together', 'forever', 'sunshine'];
    this.phrases = ['how are you', 'nice to meet you', 'have a nice day', 'see you later', 'good morning'];
    this.currentWordList = [];
    this.currentWordIndex = 0;
    this.completedWords = [];

    this.init();
  }

  async init() {
    console.log('正在初始化嗓音训练应用...');

    // Initialize audio
    try {
      await this.audioManager.initialize();
      this.pitchDetector = new PitchDetector(this.audioManager.getSampleRate());
      this.formantAnalyzer = new FormantAnalyzer(this.audioManager.getSampleRate());
      console.log('Audio initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      alert('需要麦克风权限 for this app to work. Please allow microphone access and refresh the page.');
      return;
    }

    // Load progress and update UI
    this.loadProgress();
    this.updateNavStats();
    this.renderHome();

    // Check for daily login
    this.gamification.checkStreakAchievements();
  }

  loadProgress() {
    const progress = this.storage.getProgress();
    const settings = this.storage.getSettings();

    // Update section cards
    if (progress.section2Unlocked) {
      document.getElementById('section2Card').classList.remove('locked');
      document.querySelector('#section2Card .btn').disabled = false;
      document.querySelector('#section2Card .btn').textContent = 'Start Practice';
      document.querySelector('#section2Card .btn').classList.remove('btn-secondary');
      document.querySelector('#section2Card .btn').classList.add('btn-primary');
    }

    if (progress.section3Unlocked) {
      document.getElementById('section3Card').classList.remove('locked');
      document.querySelector('#section3Card .btn').disabled = false;
      document.querySelector('#section3Card .btn').textContent = 'Start Practice';
      document.querySelector('#section3Card .btn').classList.remove('btn-secondary');
      document.querySelector('#section3Card .btn').classList.add('btn-primary');
    }

    if (progress.section4Unlocked) {
      document.getElementById('section4Card').classList.remove('locked');
      document.querySelector('#section4Card .btn').disabled = false;
      document.querySelector('#section4Card .btn').textContent = 'Start Practice';
      document.querySelector('#section4Card .btn').classList.remove('btn-secondary');
      document.querySelector('#section4Card .btn').classList.add('btn-primary');
    }

    // Load settings
    document.getElementById('noteSelect').value = settings.targetNote;
    document.getElementById('darkModeToggle').checked = settings.darkMode;
    document.getElementById('notificationsToggle').checked = settings.notificationsEnabled;
  }

  updateNavStats() {
    const gamification = this.storage.getGamification();
    document.getElementById('navLevel').textContent = gamification.level;
    document.getElementById('navStreak').textContent = `${gamification.streak}🔥`;
  }

  renderHome() {
    const gamification = this.storage.getGamification();
    const progress = this.storage.getProgress();

    // Draw XP progress
    const xpCanvas = document.getElementById('xpProgressCanvas');
    if (xpCanvas) {
      const progressInfo = this.gamification.getProgressToNextLevel();
      this.charts.drawProgressBar(xpCanvas, progressInfo.currentXP, progressInfo.xpNeeded, `Level ${gamification.level}`);
    }

    // Draw streak calendar
    const streakCanvas = document.getElementById('streakCalendarCanvas');
    if (streakCanvas) {
      this.charts.drawStreakCalendar(streakCanvas, gamification.dailyPracticeMinutes, gamification.streak);
    }

    // Update section progress text
    const section1Prog = document.getElementById('section1Progress');
    if (section1Prog) {
      const consecutive = progress.section1Stats.consecutiveSuccesses;
      if (consecutive > 0) {
        section1Prog.textContent = `进度： ${consecutive}/3 次连续成功`;
      } else {
        section1Prog.textContent = '连续3次通过即可解锁第二部分';
      }
    }

    const section2Prog = document.getElementById('section2Progress');
    if (section2Prog && progress.section2Unlocked) {
      const completed = progress.section2Stats.completedSessions;
      if (completed > 0) {
        section2Prog.textContent = `进度： ${completed}/3 次成功训练`;
      } else {
        section2Prog.textContent = '完成3次训练即可解锁第三部分';
      }
    }

    const section3Prog = document.getElementById('section3Progress');
    if (section3Prog && progress.section3Unlocked) {
      const consecutive = progress.section3Stats.consecutiveSuccesses;
      if (consecutive > 0) {
        section3Prog.textContent = `进度： ${consecutive}/3 次连续成功`;
      } else {
        section3Prog.textContent = '连续3次通过即可解锁第四部分';
      }
    }
  }

navigateTo(screen) {
    try {
      // Visual debug: show what's happening
      var dbg = document.getElementById('_navDebug');
      if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = '_navDebug';
        dbg.style.cssText = 'position:fixed;top:4px;left:4px;background:#00d9ff;color:#000;padding:4px 8px;font-size:11px;z-index:99999;border-radius:4px;';
        document.body.appendChild(dbg);
      }
      dbg.textContent = '→ ' + screen;

      // Hide all screens
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      // Show target screen
      const target = document.getElementById(screen + 'Screen');
      if (!target) { dbg.textContent = '❌ 未找到: ' + screen + 'Screen'; return; }
      target.classList.add('active');
      dbg.textContent = '✅ ' + screen + ' 已显示';

      // Render screen-specific content
      if (screen === 'home') {
        this.renderHome();
      } else if (screen === 'achievements') {
        this.renderAchievements();
      } else if (screen === 'progress') {
        this.renderProgress();
      } else if (screen === 'section1') {
        this.renderSection1();
      } else if (screen === 'section2') {
        this.renderSection2();
      } else if (screen === 'section3') {
        this.renderSection3();
      } else if (screen === 'section4') {
        this.renderSection4();
      } else if (screen === 'section5') {
        this.renderSection5();
      } else if (screen === 'section6') {
        this.renderSection6();
      } else if (screen === 'section7') {
        this.renderSection7();
      }
      // Resume audio context if needed
      this.audioManager.resume();
    } catch(e) {
      var dbg = document.getElementById('_navDebug');
      if (dbg) dbg.textContent = '💥 ' + e.message;
      console.error(e);
    }
  }

  // Section 1: Pitch Practice
  renderSection1() {
    const settings = this.storage.getSettings();
    document.getElementById('targetNoteDisplay').textContent = `${settings.targetNote} (${settings.targetFrequency.toFixed(2)} Hz)`;
  }

  async startPitchExercise() {
    document.getElementById('startPitchPracticeBtn').style.display = 'none';
    document.getElementById('startPitchTestBtn').style.display = 'none';
    document.getElementById('pitchResultsSection').style.display = 'none';

    this.currentExercise = 'pitch';
    this.exerciseStartTime = Date.now();
    this.exerciseData = [];

    const settings = this.storage.getSettings();
    const targetFreq = settings.targetFrequency;

    this.pitchDetector.clearHistory();

    // Show ready light after 2 seconds
    setTimeout(() => {
      document.getElementById('readyLight').classList.add('active');
    }, 2000);

    let targetHitTime = null;
    let sessionStarted = false;
    let sustainStartTime = null;
    let sustainDuration = 0;
    const requiredSustainSeconds = 3; // Must hold for 3 seconds

    // Track actual humming time (not including silence)
    let totalHummingTime = 0;
    const targetHummingSeconds = 30; // Auto-stop after 30s of humming

    // Failure threshold tracking
    let pitchFailureStartTime = null;
    const pitchFailureThreshold = 150; // Hz
    const pitchFailureTimeLimit = 0.5; // seconds
    let exerciseFailed = false;

    // Start recording and analyzing
    let callbackCount = 0;
    let lastLogTime = Date.now();
    let lastCallbackTime = Date.now();

    this.audioManager.startRecording((audioData) => {
      if (exerciseFailed) return; // Stop processing if failed

      callbackCount++;
      const now = Date.now();
      const deltaTime = (now - lastCallbackTime) / 1000; // Time since last callback in seconds
      lastCallbackTime = now;

      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      // Log pitch every 2 seconds for debugging
      if (now - lastLogTime > 2000) {
        console.log('🎵 Current pitch:', pitch ? `${pitch.toFixed(1)} Hz` : 'none', '| Humming time:', totalHummingTime.toFixed(1), 's/', targetHummingSeconds, 's');
        lastLogTime = now;
      }

      if (pitch) {
        // Count this as humming time
        totalHummingTime += deltaTime;

        const avgPitch = this.pitchDetector.getAveragePitch(5);
        const stdDev = this.pitchDetector.getStandardDeviation(10);

        // Update UI
        document.getElementById('currentPitch').textContent = `${avgPitch.toFixed(1)} Hz`;

        const accuracy = Math.abs(avgPitch - targetFreq);
        document.getElementById('pitchStability').textContent = `${stdDev.toFixed(1)} Hz`;

        // Draw pitch meter
        const canvas = document.getElementById('pitchMeterCanvas');
        if (canvas) {
          this.charts.drawPitchMeter(canvas, avgPitch, targetFreq);
        }

        // Check failure threshold: pitch below 150 Hz for > 0.5s
        if (avgPitch < pitchFailureThreshold) {
          if (!pitchFailureStartTime) {
            pitchFailureStartTime = Date.now();
          } else {
            const failureDuration = (Date.now() - pitchFailureStartTime) / 1000;
            if (failureDuration > pitchFailureTimeLimit) {
              exerciseFailed = true;
              console.log('❌ FAILURE: Pitch dropped below 150 Hz for too long');
              this.audioManager.stopRecording();
              document.getElementById('readyLight').classList.remove('active');
              alert('⚠️ Exercise disqualified!\n\nYour pitch dropped below 150 Hz for longer than 0.5 seconds.\n\nThis suggests your voice is slipping toward your old pitch habit. Take a breath and try again!');
              document.getElementById('startPitchPracticeBtn').style.display = 'inline-block';
              document.getElementById('startPitchTestBtn').style.display = 'inline-block';
              return;
            }
          }
        } else {
          pitchFailureStartTime = null; // Reset failure timer
        }

        // Check if currently on target
        const onTarget = this.pitchDetector.isOnTarget(avgPitch, targetFreq, 5);

        // Track sustain time
        if (onTarget) {
          if (!sustainStartTime) {
            sustainStartTime = Date.now();
            console.log('🎯 On target! Starting sustain timer...');
          } else {
            sustainDuration = (Date.now() - sustainStartTime) / 1000;

            // Update sustain display
            const sustainText = `Sustaining: ${sustainDuration.toFixed(1)}s / ${requiredSustainSeconds}s`;
            document.getElementById('pitchAccuracy').textContent = sustainText;

            // Check if we've sustained long enough to start recording
            if (sustainDuration >= requiredSustainSeconds && !sessionStarted) {
              targetHitTime = Date.now() - this.exerciseStartTime;
              sessionStarted = true;
              console.log('✅ Sustained for 3 seconds! Starting session recording.');
            }
          }
        } else {
          // Lost target - reset sustain timer if we haven't started recording yet
          if (!sessionStarted && sustainStartTime) {
            console.log('❌ Lost target. Resetting sustain timer.');
            sustainStartTime = null;
            sustainDuration = 0;
          }
        }

        // Update UI with progress
        if (sessionStarted) {
          const remainingTime = Math.max(0, targetHummingSeconds - totalHummingTime);
          document.getElementById('pitchAccuracy').textContent = `Recording: ${remainingTime.toFixed(1)}s left`;
        }

        // Record data only after sustaining for required time
        if (sessionStarted) {
          this.exerciseData.push({
            timestamp: Date.now() - this.exerciseStartTime,
            pitch: avgPitch,
            stdDev: stdDev
          });
        }

        // Auto-stop after 30 seconds of humming
        if (totalHummingTime >= targetHummingSeconds) {
          console.log('⏱️ Auto-stopping after 30 seconds of humming');
          document.getElementById('readyLight').classList.remove('active');
          this.stopPitchExercise();
        }
      }
    });
  }

  stopPitchExercise() {
    this.audioManager.stopRecording();

    document.getElementById('startPitchPracticeBtn').style.display = 'inline-block';
    document.getElementById('startPitchTestBtn').style.display = 'inline-block';
    document.getElementById('readyLight').classList.remove('active');

    if (this.exerciseData.length === 0) {
      alert('没有录到数据. 请再试一次 and make sure to hum at your target pitch.');
      return;
    }

    // Calculate results
    const settings = this.storage.getSettings();
    const targetFreq = settings.targetFrequency;

    const pitches = this.exerciseData.map(d => d.pitch);
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;

    const stdDevs = this.exerciseData.map(d => d.stdDev);
    const avgStdDev = stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length;

    const duration = (Date.now() - this.exerciseStartTime) / 1000; // seconds
    const timeToHit = this.exerciseData[0].timestamp / 1000;

    // Calculate score
    const score = this.gamification.calculatePitchScore(targetFreq, avgPitch, timeToHit, duration, avgStdDev);

    document.getElementById('pitchScore').textContent = score;

    // Save progress
    this.storage.updateProgress(1, {
      attempts: this.storage.getProgress().section1Stats.attempts + 1,
      bestAccuracy: Math.min(this.storage.getProgress().section1Stats.bestAccuracy || 999, Math.abs(avgPitch - targetFreq)),
      avgStdDev: avgStdDev
    });

    this.storage.addPitchHistory({
      avgPitch: avgPitch,
      stdDev: avgStdDev,
      score: score
    });

    // Award XP
    const xpResult = this.gamification.awardXP(1, score);

    // Check achievements
    const achievements = [];

    if (this.storage.getProgress().section1Stats.attempts === 1) {
      const ach = this.gamification.checkAchievement('firstSteps');
      if (ach) achievements.push(ach);
    }

    if (Math.abs(avgPitch - targetFreq) <= 1) {
      const ach = this.gamification.checkAchievement('pitchPerfect');
      if (ach) achievements.push(ach);
    }

    if (duration >= 30 && avgStdDev < 5) {
      const ach = this.gamification.checkAchievement('rockSolid');
      if (ach) achievements.push(ach);
    }

    if (timeToHit < 1) {
      const ach = this.gamification.checkAchievement('speedster');
      if (ach) achievements.push(ach);
    }

    // Track 次连续成功 for unlocking
    const progress = this.storage.getProgress();
    const passedThreshold = avgStdDev < 10;

    if (passedThreshold) {
      // Success! Increment consecutive counter
      const newConsecutive = progress.section1Stats.consecutiveSuccesses + 1;
      this.storage.updateProgress(1, { consecutiveSuccesses: newConsecutive });

      console.log(`✅ Passed! Consecutive successes: ${newConsecutive}/3`);

      // Check if we've hit the required number
      if (newConsecutive >= 3 && !progress.section2Unlocked) {
        this.storage.unlockSection(2);
        alert('🎉 Congratulations! You\'ve passed 3 times in a row!\n\nSection II: Resonance Training is now unlocked!');
        this.loadProgress();
      } else if (newConsecutive < 3) {
        alert(`Great job! 🎯\n\nConsecutive successes: ${newConsecutive}/3\n\nKeep it up - ${3 - newConsecutive} more to unlock Section II!`);
      }
    } else {
      // Failed - reset counter
      if (progress.section1Stats.consecutiveSuccesses > 0) {
        console.log(`❌ Didn't pass (${avgStdDev.toFixed(1)}Hz std dev). Resetting consecutive counter.`);
        this.storage.updateProgress(1, { consecutiveSuccesses: 0 });
        alert(`Keep practicing! 💪\n\nYour pitch stability was ${avgStdDev.toFixed(1)}Hz (need <10Hz).\n\nConsecutive successes reset to 0/3.`);
      }
    }

    // Show achievements
    achievements.forEach(ach => this.showAchievementNotification(ach));

    // Update nav
    this.updateNavStats();

    // Add practice time
    this.storage.addDailyPracticeTime(duration / 60);

    // Show results
    const resultsSection = document.getElementById('pitchResultsSection');
    const resultsContent = document.getElementById('pitchResultsContent');

    resultsContent.innerHTML = `
      <div class="live-stats">
        <div class="stat-box">
          <span class="stat-label">平均音高</span>
          <span class="stat-value">${avgPitch.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">目标</span>
          <span class="stat-value">${targetFreq.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">稳定性</span>
          <span class="stat-value">${avgStdDev.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">时长</span>
          <span class="stat-value">${duration.toFixed(1)}s</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Score</span>
          <span class="stat-value highlight-primary">${score}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">获得经验</span>
          <span class="stat-value highlight-success">+${xpResult.xpGained}</span>
        </div>
      </div>
      <div id="pitchCoachTips" style="margin-top:12px;"></div>
    `;

    // AI Coach tips
    const tips = this.aiCoach.analyzePitch({
      avgPitch, targetFreq, stdDev: avgStdDev, duration,
      consecutivePasses: this.storage.getProgress().section1Stats.consecutiveSuccesses
    });
    this.renderCoachTips('pitchCoachTips', tips);

    resultsSection.style.display = 'block';
  }

  // Section 1: Practice Mode (no time limit, no failure)
  async startPitchPractice() {
    document.getElementById('startPitchPracticeBtn').style.display = 'none';
    document.getElementById('startPitchTestBtn').style.display = 'none';
    document.getElementById('stopPitchPracticeBtn').style.display = 'inline-block';
    document.getElementById('pitchResultsSection').style.display = 'none';

    const indicator = document.getElementById('pitchModeIndicator');
    indicator.style.display = 'block';
    indicator.textContent = '🎵 PRACTICE MODE - Hum freely, no limits!';
    indicator.style.color = '#00d9ff';

    this.currentExercise = 'pitch-practice';
    this.exerciseStartTime = Date.now();

    const settings = this.storage.getSettings();
    const targetFreq = settings.targetFrequency;

    this.pitchDetector.clearHistory();

    // Start recording and analyzing
    this.audioManager.startRecording((audioData) => {
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (pitch) {
        const avgPitch = this.pitchDetector.getAveragePitch(5);
        const stdDev = this.pitchDetector.getStandardDeviation(10);

        // Update UI
        document.getElementById('currentPitch').textContent = `${avgPitch.toFixed(1)} Hz`;
        document.getElementById('pitchStability').textContent = `${stdDev.toFixed(1)} Hz`;

        // Color code the status based on pitch
        const statusEl = document.getElementById('pitchAccuracy');
        const accuracy = Math.abs(avgPitch - targetFreq);

        if (avgPitch < 150) {
          statusEl.textContent = '❌ TOO LOW (< 150 Hz)';
          statusEl.style.color = '#ff4757';
        } else if (accuracy <= 5) {
          statusEl.textContent = '✅ ON TARGET';
          statusEl.style.color = '#2ed573';
        } else if (accuracy <= 10) {
          statusEl.textContent = '⚠️ CLOSE';
          statusEl.style.color = '#ffa502';
        } else {
          statusEl.textContent = `Off by ${accuracy.toFixed(1)} Hz`;
          statusEl.style.color = '#ffa502';
        }

        // Draw pitch meter with color coding
        const canvas = document.getElementById('pitchMeterCanvas');
        if (canvas) {
          this.charts.drawPitchMeter(canvas, avgPitch, targetFreq);
        }
      } else {
        document.getElementById('pitchAccuracy').textContent = 'No sound detected';
        document.getElementById('pitchAccuracy').style.color = '#a4b0be';
      }
    });
  }

  stopPitchPractice() {
    this.audioManager.stopRecording();

    document.getElementById('startPitchPracticeBtn').style.display = 'inline-block';
    document.getElementById('startPitchTestBtn').style.display = 'inline-block';
    document.getElementById('stopPitchPracticeBtn').style.display = 'none';
    document.getElementById('pitchModeIndicator').style.display = 'none';

    // Reset displays
    document.getElementById('currentPitch').textContent = '-- Hz';
    document.getElementById('pitchAccuracy').textContent = '--';
    document.getElementById('pitchAccuracy').style.color = '';
    document.getElementById('pitchStability').textContent = '-- Hz';
  }

  // Section 2: Advanced Pitch Practice (Sentences)
  renderSection2() {
    this.currentSentenceIndex = 0;
    this.updateSentenceDisplay();
    this.updateTierIndicator();
    const progress = this.storage.getProgress();
    document.getElementById('sentenceProgress').textContent = `${progress.section2Stats.sentencesCompleted.length}/6`;
  }

  updateTierIndicator() {
    const sentence = this.sentences[this.currentSentenceIndex];
    const indicator = document.getElementById('tierIndicator');

    if (sentence.tier === 1) {
      indicator.innerHTML = `<h3>Tier 1: High Vowel Anchors</h3><p>Easiest - Practice with bright 'ee' and 'ay' sounds</p>`;
    } else if (sentence.tier === 2) {
      indicator.innerHTML = `<h3>Tier 2: Transitional Vowel Challenges</h3><p>Medium - Maintain pitch through 'oh' and 'ah' sounds</p>`;
    } else if (sentence.tier === 3) {
      indicator.innerHTML = `<h3>Tier 3: Low Consonant Resistance</h3><p>Hard - Overcome difficult consonants ('L', 'M', 'N')</p>`;
    }
  }

  updateSentenceDisplay() {
    const sentence = this.sentences[this.currentSentenceIndex];
    document.getElementById('currentSentence').textContent = `"${sentence.text}"`;
    this.updateTierIndicator();
  }

  nextSentence() {
    // First, evaluate the current sentence
    if (this.isTestMode) {
      this.evaluateSentence();
    } else {
      // In practice mode, just move to next sentence
      this.currentSentenceIndex++;
      if (this.currentSentenceIndex >= this.sentences.length) {
        this.currentSentenceIndex = 0;
      }
      this.updateSentenceDisplay();
      document.getElementById('sentenceResultsSection').style.display = 'none';
    }
  }

  async startSentencePractice() {
    document.getElementById('startSentencePracticeBtn').style.display = 'none';
    document.getElementById('startSentenceTestBtn').style.display = 'none';
    document.getElementById('stopSentencePracticeBtn').style.display = 'inline-block';
    document.getElementById('sentenceResultsSection').style.display = 'none';

    const indicator = document.getElementById('sentenceModeIndicator');
    indicator.style.display = 'block';
    indicator.textContent = '🗣️ PRACTICE MODE - Speak freely, get feedback!';
    indicator.style.color = '#00d9ff';

    this.currentExercise = 'sentence-practice';
    this.exerciseStartTime = Date.now();

    const targetFreq = 165; // Hz - the pitch anchor

    this.pitchDetector.clearHistory();

    // Start recording and analyzing
    this.audioManager.startRecording((audioData) => {
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (pitch) {
        const avgPitch = this.pitchDetector.getAveragePitch(5);
        const stdDev = this.pitchDetector.getStandardDeviation(10);

        // Update UI
        document.getElementById('sentenceCurrentPitch').textContent = `${avgPitch.toFixed(1)} Hz`;
        document.getElementById('sentenceMelodicStability').textContent = `${stdDev.toFixed(1)} Hz`;

        // Color code the status based on pitch and stability
        const statusEl = document.getElementById('sentenceStatus');

        if (avgPitch < 150) {
          statusEl.textContent = '❌ TOO LOW (< 150 Hz)';
          statusEl.style.color = '#ff4757';
        } else if (stdDev > 15) {
          statusEl.textContent = '⚠️ TOO MUCH VARIATION';
          statusEl.style.color = '#ffa502';
        } else if (stdDev < 15 && Math.abs(avgPitch - targetFreq) <= 10) {
          statusEl.textContent = '✅ EXCELLENT!';
          statusEl.style.color = '#2ed573';
        } else {
          statusEl.textContent = 'GOOD - Keep going!';
          statusEl.style.color = '#00d9ff';
        }

        // Draw pitch meter
        const canvas = document.getElementById('sentencePitchMeterCanvas');
        if (canvas) {
          this.charts.drawPitchMeter(canvas, avgPitch, targetFreq);
        }
      } else {
        document.getElementById('sentenceStatus').textContent = 'No sound detected';
        document.getElementById('sentenceStatus').style.color = '#a4b0be';
      }
    });
  }

  stopSentencePractice() {
    this.audioManager.stopRecording();

    document.getElementById('startSentencePracticeBtn').style.display = 'inline-block';
    document.getElementById('startSentenceTestBtn').style.display = 'inline-block';
    document.getElementById('stopSentencePracticeBtn').style.display = 'none';
    document.getElementById('sentenceModeIndicator').style.display = 'none';

    // Reset displays
    document.getElementById('sentenceCurrentPitch').textContent = '-- Hz';
    document.getElementById('sentenceStatus').textContent = 'Ready';
    document.getElementById('sentenceStatus').style.color = '';
    document.getElementById('sentenceMelodicStability').textContent = '-- Hz';
  }

  async startSentenceTest() {
    // This will cycle through all 6 sentences
    this.isTestMode = true;
    this.testSentencesCompleted = [];
    this.currentSentenceIndex = 0;
    this.updateSentenceDisplay();

    document.getElementById('startSentencePracticeBtn').style.display = 'none';
    document.getElementById('startSentenceTestBtn').style.display = 'none';
    document.getElementById('nextSentenceBtn').style.display = 'inline-block';

    const indicator = document.getElementById('sentenceModeIndicator');
    indicator.style.display = 'block';
    indicator.textContent = '🎯 TEST MODE - Read when ready, then click Next';
    indicator.style.color = '#ffa502';

    // Start recording for this sentence
    this.startSentenceRecording();
  }

  startSentenceRecording() {
    this.exerciseStartTime = Date.now();
    this.exerciseData = [];
    this.pitchDetector.clearHistory();

    const targetFreq = 165;

    this.audioManager.startRecording((audioData) => {
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (pitch) {
        const avgPitch = this.pitchDetector.getAveragePitch(5);
        const stdDev = this.pitchDetector.getStandardDeviation(10);

        // Update UI
        document.getElementById('sentenceCurrentPitch').textContent = `${avgPitch.toFixed(1)} Hz`;
        document.getElementById('sentenceMelodicStability').textContent = `${stdDev.toFixed(1)} Hz`;

        // Record data
        this.exerciseData.push({
          timestamp: Date.now() - this.exerciseStartTime,
          pitch: avgPitch,
          stdDev: stdDev
        });

        // Draw pitch meter
        const canvas = document.getElementById('sentencePitchMeterCanvas');
        if (canvas) {
          this.charts.drawPitchMeter(canvas, avgPitch, targetFreq);
        }
      }
    });
  }

  async evaluateSentence() {
    this.audioManager.stopRecording();

    if (this.exerciseData.length === 0) {
      alert('未检测到声音. 请再试一次 and make sure to speak the sentence.');
      this.startSentenceRecording();
      return;
    }

    // Calculate melodic stability (std dev across the entire sentence)
    const pitches = this.exerciseData.map(d => d.pitch);
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, pitch) => sum + Math.pow(pitch - avgPitch, 2), 0) / pitches.length;
    const melodicStability = Math.sqrt(variance);

    const sentence = this.sentences[this.currentSentenceIndex];
    const passed = melodicStability < 15 && avgPitch >= 150;

    // Show result
    const resultsSection = document.getElementById('sentenceResultsSection');
    const resultsContent = document.getElementById('sentenceResultsContent');
    const resultTitle = document.getElementById('sentenceResultTitle');

    resultTitle.textContent = passed ? '✅ Passed!' : '❌ Try Again';
    resultTitle.style.color = passed ? 'var(--color-success)' : 'var(--color-danger)';

    resultsContent.innerHTML = `
      <div class="live-stats">
        <div class="stat-box">
          <span class="stat-label">平均音高</span>
          <span class="stat-value">${avgPitch.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Melodic 稳定性</span>
          <span class="stat-value">${melodicStability.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">目标</span>
          <span class="stat-value">&lt; 15 Hz</span>
        </div>
      </div>
      <p style="margin-top: 1rem; text-align: center;">
        ${passed ? 'Great job! Your pitch remained stable.' : 'Keep practicing! Try to reduce pitch variation to below 15 Hz.'}
      </p>
    `;

    resultsSection.style.display = 'block';

    if (passed) {
      this.testSentencesCompleted.push(this.currentSentenceIndex);
    }

    // Update progress display
    document.getElementById('sentenceProgress').textContent = `${this.testSentencesCompleted.length}/6`;

    // Move to next sentence
    this.currentSentenceIndex++;

    // Check if all sentences are complete
    if (this.currentSentenceIndex >= this.sentences.length) {
      // Check if we passed all sentences
      if (this.testSentencesCompleted.length === 6) {
        // Session complete!
        const progress = this.storage.getProgress();
        const newSessions = progress.section2Stats.completedSessions + 1;

        this.storage.updateProgress(2, {
          completedSessions: newSessions,
          attempts: progress.section2Stats.attempts + 1
        });

        if (newSessions >= 3 && !progress.section3Unlocked) {
          this.storage.unlockSection(3);
          alert('🎉 Congratulations! You\'ve completed 3 次成功训练!\n\nSection III: Resonance Training is now unlocked!');
          this.loadProgress();
        } else if (newSessions < 3) {
          alert(`🎯 Session Complete!\n\nYou passed all 6 sentences!\n\nCompleted sessions: ${newSessions}/3\n\nComplete ${3 - newSessions} more sessions to unlock Section III!`);
        }
      } else {
        alert(`Test incomplete. You only passed ${this.testSentencesCompleted.length} out of 6 sentences. Try again!`);
      }

      // Reset test mode
      this.isTestMode = false;
      this.currentSentenceIndex = 0;
      this.updateSentenceDisplay();
      document.getElementById('nextSentenceBtn').style.display = 'none';
      document.getElementById('startSentencePracticeBtn').style.display = 'inline-block';
      document.getElementById('startSentenceTestBtn').style.display = 'inline-block';
      document.getElementById('sentenceModeIndicator').style.display = 'none';
      document.getElementById('sentenceResultsSection').style.display = 'none';
    } else {
      // Continue to next sentence
      this.updateSentenceDisplay();
      this.startSentenceRecording();
    }
  }

  // Section 3: Resonance Training
  renderSection3() {
    // Nothing special to render
  }

  async startResonanceExercise() {
    document.getElementById('startResonancePracticeBtn').style.display = 'none';
    document.getElementById('startResonanceTestBtn').style.display = 'none';
    document.getElementById('resonanceResultsSection').style.display = 'none';

    this.currentExercise = 'resonance';
    this.exerciseStartTime = Date.now();
    this.exerciseData = [];

    this.formantAnalyzer.clearHistory();
    this.pitchDetector.clearHistory();
    this.resonanceHistory = [];

    // Track actual humming time (not including silence)
    let totalHummingTime = 0;
    const targetHummingSeconds = 30; // Auto-stop after 30s of humming
    let lastCallbackTime = Date.now();

    // Failure threshold tracking
    let stabilityFailureStartTime = null;
    const stabilityFailureThreshold = 15; // % (std dev)
    const stabilityFailureTimeLimit = 1; // seconds
    let exerciseFailed = false;

    // Start recording and analyzing
    this.audioManager.startRecording((audioData) => {
      if (exerciseFailed) return; // Stop processing if failed

      const now = Date.now();
      const deltaTime = (now - lastCallbackTime) / 1000; // Time since last callback in seconds
      lastCallbackTime = now;

      const formants = this.formantAnalyzer.analyzeFormants(audioData.timeDomainData);
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (formants && pitch) {
        // Count this as humming time
        totalHummingTime += deltaTime;

        const avgFormants = this.formantAnalyzer.getAverageFormants(5);
        const stability = this.formantAnalyzer.getResonanceStability(10);
        const brightness = this.formantAnalyzer.getBrightnessRatio();
        
        // ─── 共鸣比分析（新增） ───
        const resonanceRatio = this.formantAnalyzer.getResonanceRatio(audioData.timeDomainData);

        // Track resonance history for heatmap in test mode
        this.resonanceHistory.push({ f1: avgFormants.F1, f2: avgFormants.F2 });
        if (this.resonanceHistory.length > 80) this.resonanceHistory.shift();
        const hmCanvas = document.getElementById('resonanceHeatmapCanvas');
        if (hmCanvas) this.charts.drawResonanceHeatmap(hmCanvas, avgFormants.F1, avgFormants.F2, this.resonanceHistory);

        // 绘制共鸣比仪表盘（新增）
        const ratioGaugeCanvas = document.getElementById('resonanceRatioGaugeCanvas');
        if (ratioGaugeCanvas) this.charts.drawResonanceRatioGauge(ratioGaugeCanvas, resonanceRatio);
        const ratioTrendCanvas = document.getElementById('resonanceRatioTrendCanvas');
        if (ratioTrendCanvas) {
          const history = this.formantAnalyzer.getResonanceRatioHistory(50);
          this.charts.drawResonanceTrend(ratioTrendCanvas, history);
        }

        // 共鸣比百分比显示
        if (resonanceRatio) {
          document.getElementById('resonanceRatioDisplay').textContent = `${resonanceRatio.headPct.toFixed(0)}%`;
          document.getElementById('resonanceRatioLabel').textContent = resonanceRatio.headDominant ? '头腔共鸣 ✅' : '胸腔共鸣 🔴';
          document.getElementById('resonanceRatioLabel').style.color = resonanceRatio.headDominant ? '#16c79a' : '#e94560';
        }

        // Update UI (test mode)
        document.getElementById('f1Display').textContent = `${avgFormants.F1.toFixed(0)} Hz`;
        document.getElementById('f2Display').textContent = `${avgFormants.F2.toFixed(0)} Hz`;
        document.getElementById('brightnessDisplay').textContent = brightness ? brightness.toFixed(2) : '--';
        document.getElementById('resonanceStability').textContent = `${stability.toFixed(1)}% | ${(targetHummingSeconds - totalHummingTime).toFixed(1)}s left`;

        // Check failure threshold: stability > 15% for > 1s
        if (stability > stabilityFailureThreshold) {
          if (!stabilityFailureStartTime) {
            stabilityFailureStartTime = Date.now();
          } else {
            const failureDuration = (Date.now() - stabilityFailureStartTime) / 1000;
            if (failureDuration > stabilityFailureTimeLimit) {
              exerciseFailed = true;
              console.log('❌ FAILURE: Stability spiked above 15% for too long');
              this.audioManager.stopRecording();
              alert('⚠️ Exercise disqualified!\n\nYour resonance stability spiked above 15% for longer than 1 second.\n\nThis indicates the "Silent K" throat posture collapsed. Re-engage the warmth and try again!');
              document.getElementById('startResonancePracticeBtn').style.display = 'inline-block';
              document.getElementById('startResonanceTestBtn').style.display = 'inline-block';
              return;
            }
          }
        } else {
          stabilityFailureStartTime = null; // Reset failure timer
        }

        // Record data
        this.exerciseData.push({
          timestamp: Date.now() - this.exerciseStartTime,
          formants: avgFormants,
          stability: stability,
          brightness: brightness,
          pitch: pitch
        });

        // Auto-stop after 30 seconds of humming
        if (totalHummingTime >= targetHummingSeconds) {
          console.log('⏱️ Auto-stopping after 30 seconds of humming');
          this.stopResonanceExercise();
        }
      }
    });
  }

  stopResonanceExercise() {
    this.audioManager.stopRecording();

    document.getElementById('startResonancePracticeBtn').style.display = 'inline-block';
    document.getElementById('startResonanceTestBtn').style.display = 'inline-block';

    if (this.exerciseData.length === 0) {
      alert('没有录到数据. 请再试一次.');
      return;
    }

    // Calculate results
    const stabilities = this.exerciseData.map(d => d.stability);
    const avgStability = stabilities.reduce((a, b) => a + b, 0) / stabilities.length;

    const duration = (Date.now() - this.exerciseStartTime) / 1000;

    const score = this.gamification.calculateResonanceScore(avgStability);

    // Save progress
    this.storage.updateProgress(3, {
      attempts: this.storage.getProgress().section3Stats.attempts + 1,
      bestResonanceStability: Math.min(this.storage.getProgress().section3Stats.bestResonanceStability || 999, avgStability),
      avgResonanceStdDev: avgStability
    });

    this.storage.addResonanceHistory({
      stability: avgStability,
      score: score
    });

    // Award XP
    const xpResult = this.gamification.awardXP(3, score);

    // Check achievements
    const achievements = [];

    if (avgStability < 10 && !this.storage.getProgress().section3Stats.completed) {
      const ach = this.gamification.checkAchievement('resonanceMaster');
      if (ach) achievements.push(ach);
      this.storage.updateProgress(3, { completed: true });
    }

    // Track 次连续成功 for unlocking Section 4
    const progress = this.storage.getProgress();
    const passedThreshold = avgStability < 10;

    if (passedThreshold) {
      // Success! Increment consecutive counter
      const newConsecutive = progress.section3Stats.consecutiveSuccesses + 1;
      this.storage.updateProgress(3, { consecutiveSuccesses: newConsecutive });

      console.log(`✅ Passed! Consecutive successes: ${newConsecutive}/3`);

      // Check if we've hit the required number
      if (newConsecutive >= 3 && !progress.section4Unlocked) {
        this.storage.unlockSection(4);
        alert('🎉 Congratulations! You\'ve passed 3 times in a row!\n\nSection IV: Word Practice is now unlocked!');
        this.loadProgress();
      } else if (newConsecutive < 3) {
        alert(`Excellent! 🔮\n\nConsecutive successes: ${newConsecutive}/3\n\nKeep going - ${3 - newConsecutive} more to unlock Section IV!`);
      }
    } else {
      // Failed - reset counter
      if (progress.section3Stats.consecutiveSuccesses > 0) {
        console.log(`❌ Didn't pass (${avgStability.toFixed(1)}% stability). Resetting consecutive counter.`);
        this.storage.updateProgress(3, { consecutiveSuccesses: 0 });
        alert(`Keep practicing! 💪\n\nYour resonance stability was ${avgStability.toFixed(1)}% (need <10%).\n\nConsecutive successes reset to 0/3.`);
      }
    }

    // Show achievements
    achievements.forEach(ach => this.showAchievementNotification(ach));

    // Update nav
    this.updateNavStats();

    // Add practice time
    this.storage.addDailyPracticeTime(duration / 60);

    // Show results
    const resultsSection = document.getElementById('resonanceResultsSection');
    const resultsContent = document.getElementById('resonanceResultsContent');

    resultsContent.innerHTML = `
      <div class="live-stats">
        <div class="stat-box">
          <span class="stat-label">Avg Stability</span>
          <span class="stat-value">${avgStability.toFixed(1)}%</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">时长</span>
          <span class="stat-value">${duration.toFixed(1)}s</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Score</span>
          <span class="stat-value highlight-primary">${score}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">获得经验</span>
          <span class="stat-value highlight-success">+${xpResult.xpGained}</span>
        </div>
      </div>
    `;

    resultsSection.style.display = 'block';
  }

  // Section 2: Practice Mode (no time limit, no failure)
  async startResonancePractice() {
    document.getElementById('startResonancePracticeBtn').style.display = 'none';
    document.getElementById('startResonanceTestBtn').style.display = 'none';
    document.getElementById('stopResonancePracticeBtn').style.display = 'inline-block';
    document.getElementById('resonanceResultsSection').style.display = 'none';

    const indicator = document.getElementById('resonanceModeIndicator');
    indicator.style.display = 'block';
    indicator.textContent = '🔮 PRACTICE MODE - Engage the Silent K posture!';
    indicator.style.color = '#00d9ff';

    this.currentExercise = 'resonance-practice';
    this.exerciseStartTime = Date.now();

    this.formantAnalyzer.clearHistory();
    this.pitchDetector.clearHistory();
    this.resonanceHistory = [];

    // Start recording and analyzing
    this.audioManager.startRecording((audioData) => {
      const formants = this.formantAnalyzer.analyzeFormants(audioData.timeDomainData);
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (formants && pitch) {
        const avgFormants = this.formantAnalyzer.getAverageFormants(5);
        const stability = this.formantAnalyzer.getResonanceStability(10);
        const brightness = this.formantAnalyzer.getBrightnessRatio();
        
        // ─── 共鸣比分析（新增） ───
        const resonanceRatio = this.formantAnalyzer.getResonanceRatio(audioData.timeDomainData);

        // Track resonance history for heatmap (keep last 80 points)
        this.resonanceHistory.push({ f1: avgFormants.F1, f2: avgFormants.F2 });
        if (this.resonanceHistory.length > 80) this.resonanceHistory.shift();

        // Draw resonance heatmap
        const heatmapCanvas = document.getElementById('resonanceHeatmapCanvas');
        if (heatmapCanvas) {
          this.charts.drawResonanceHeatmap(heatmapCanvas, avgFormants.F1, avgFormants.F2, this.resonanceHistory);
        }

        // 绘制共鸣比仪表盘（新增）
        const ratioGaugeCanvas = document.getElementById('resonanceRatioGaugeCanvas');
        if (ratioGaugeCanvas) {
          this.charts.drawResonanceRatioGauge(ratioGaugeCanvas, resonanceRatio);
        }
        
        // 绘制共鸣比趋势图（新增）
        const ratioTrendCanvas = document.getElementById('resonanceRatioTrendCanvas');
        if (ratioTrendCanvas) {
          const history = this.formantAnalyzer.getResonanceRatioHistory(50);
          this.charts.drawResonanceTrend(ratioTrendCanvas, history);
        }

        // Update UI
        document.getElementById('f1Display').textContent = `${avgFormants.F1.toFixed(0)} Hz`;
        document.getElementById('f2Display').textContent = `${avgFormants.F2.toFixed(0)} Hz`;
        document.getElementById('brightnessDisplay').textContent = brightness ? brightness.toFixed(2) : '--';

        // 共鸣比百分比显示
        if (resonanceRatio) {
          document.getElementById('resonanceRatioDisplay').textContent = `${resonanceRatio.headPct.toFixed(0)}%`;
          document.getElementById('resonanceRatioLabel').textContent = resonanceRatio.headDominant ? '头腔共鸣 ✅' : '胸腔共鸣 🔴';
          document.getElementById('resonanceRatioLabel').style.color = resonanceRatio.headDominant ? '#16c79a' : '#e94560';
        }

        // Color code the stability based on thresholds
        const stabilityEl = document.getElementById('resonanceStability');

        if (stability > 15) {
          stabilityEl.textContent = `${stability.toFixed(1)}% ❌ TOO HIGH`;
          stabilityEl.style.color = '#ff4757';
        } else if (stability < 10) {
          stabilityEl.textContent = `${stability.toFixed(1)}% ✅ EXCELLENT`;
          stabilityEl.style.color = '#2ed573';
        } else {
          stabilityEl.textContent = `${stability.toFixed(1)}% ⚠️ CLOSE`;
          stabilityEl.style.color = '#ffa502';
        }
      } else {
        document.getElementById('resonanceStability').textContent = 'No sound detected';
        document.getElementById('resonanceStability').style.color = '#a4b0be';
        document.getElementById('resonanceRatioDisplay').textContent = '--';
        document.getElementById('resonanceRatioLabel').textContent = '等待声音...';
      }
    });
  }

  stopResonancePractice() {
    this.audioManager.stopRecording();

    document.getElementById('startResonancePracticeBtn').style.display = 'inline-block';
    document.getElementById('startResonanceTestBtn').style.display = 'inline-block';
    document.getElementById('stopResonancePracticeBtn').style.display = 'none';
    document.getElementById('resonanceModeIndicator').style.display = 'none';

    // Reset displays
    document.getElementById('f1Display').textContent = '-- Hz';
    document.getElementById('f2Display').textContent = '-- Hz';
    document.getElementById('brightnessDisplay').textContent = '--';
    document.getElementById('resonanceStability').textContent = '-- %';
    document.getElementById('resonanceStability').style.color = '';
  }

  // Section 4: Word Practice
  renderSection4() {
    this.selectWordLevel('vowels');
  }

  selectWordLevel(level) {
    // Update active button
    document.querySelectorAll('.level-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.level-btn[data-level="${level}"]`).classList.add('active');

    // Set word list
    if (level === 'vowels') {
      this.currentWordList = this.vowels;
    } else if (level === 'words') {
      this.currentWordList = this.words;
    } else if (level === 'phrases') {
      this.currentWordList = this.phrases;
    }

    // Load completed words for this level
    const progress = this.storage.getProgress().section4Stats;
    if (level === 'vowels') {
      this.completedWords = progress.vowelsCompleted || [];
    } else if (level === 'words') {
      this.completedWords = progress.wordsCompleted || [];
    } else if (level === 'phrases') {
      this.completedWords = progress.phrasesCompleted || [];
    }

    // Set current word
    this.currentWordIndex = 0;
    this.showNextWord();

    // Render completed words
    this.renderCompletedWords();
  }

  showNextWord() {
    if (this.currentWordIndex >= this.currentWordList.length) {
      alert('🎉 You\'ve completed all items in this level!');
      return;
    }

    const word = this.currentWordList[this.currentWordIndex];
    document.getElementById('currentWord').textContent = word;
  }

  nextWord() {
    this.currentWordIndex++;
    this.showNextWord();
    document.getElementById('wordResultsSection').style.display = 'none';
  }

  renderCompletedWords() {
    const container = document.getElementById('completedWords');
    container.innerHTML = '';

    this.completedWords.forEach(word => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = word;
      container.appendChild(chip);
    });
  }

  async startWordExercise() {
    document.getElementById('startWordBtn').style.display = 'none';
    document.getElementById('stopWordBtn').style.display = 'inline-block';
    document.getElementById('wordResultsSection').style.display = 'none';

    this.currentExercise = 'word';
    this.exerciseStartTime = Date.now();
    this.exerciseData = [];

    this.formantAnalyzer.clearHistory();
    this.pitchDetector.clearHistory();

    const settings = this.storage.getSettings();

    // Start recording and analyzing
    this.audioManager.startRecording((audioData) => {
      const formants = this.formantAnalyzer.analyzeFormants(audioData.timeDomainData);
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);

      if (formants && pitch) {
        const pitchStdDev = this.pitchDetector.getStandardDeviation(10);
        const resonanceStability = this.formantAnalyzer.getResonanceStability(10);

        // Update UI
        document.getElementById('wordPitchStability').textContent = `${pitchStdDev.toFixed(1)} Hz`;
        document.getElementById('wordResonanceStability').textContent = `${resonanceStability.toFixed(1)}%`;

        // Record data
        this.exerciseData.push({
          timestamp: Date.now() - this.exerciseStartTime,
          pitch: pitch,
          pitchStdDev: pitchStdDev,
          formants: formants,
          resonanceStability: resonanceStability
        });
      }
    });
  }

  stopWordExercise() {
    this.audioManager.stopRecording();

    document.getElementById('startWordBtn').style.display = 'inline-block';
    document.getElementById('stopWordBtn').style.display = 'none';

    if (this.exerciseData.length === 0) {
      alert('没有录到数据. 请再试一次.');
      return;
    }

    // Calculate results
    const pitchStdDevs = this.exerciseData.map(d => d.pitchStdDev);
    const avgPitchStdDev = pitchStdDevs.reduce((a, b) => a + b, 0) / pitchStdDevs.length;

    const resonanceStabilities = this.exerciseData.map(d => d.resonanceStability);
    const avgResonanceStability = resonanceStabilities.reduce((a, b) => a + b, 0) / resonanceStabilities.length;

    const duration = (Date.now() - this.exerciseStartTime) / 1000;

    const score = this.gamification.calculateWordScore(avgPitchStdDev, avgResonanceStability);

    // Check if passed
    const passed = avgPitchStdDev < 10 && avgResonanceStability < 10;

    const currentWord = this.currentWordList[this.currentWordIndex];

    if (passed && !this.completedWords.includes(currentWord)) {
      this.completedWords.push(currentWord);

      // Save progress
      const progress = this.storage.getProgress().section4Stats;
      const level = document.querySelector('.level-btn.active').dataset.level;

      if (level === 'vowels') {
        progress.vowelsCompleted = this.completedWords;

        if (this.completedWords.length === this.vowels.length) {
          const ach = this.gamification.checkAchievement('vowelVirtuoso');
          if (ach) this.showAchievementNotification(ach);
        }
      } else if (level === 'words') {
        progress.wordsCompleted = this.completedWords;

        if (this.completedWords.length >= 50) {
          const ach = this.gamification.checkAchievement('wordWizard');
          if (ach) this.showAchievementNotification(ach);
        }
      } else if (level === 'phrases') {
        progress.phrasesCompleted = this.completedWords;

        if (this.completedWords.length >= 25) {
          const ach = this.gamification.checkAchievement('phrasePhenom');
          if (ach) this.showAchievementNotification(ach);
        }
      }

      this.storage.updateProgress(4, progress);
      this.renderCompletedWords();
    }

    // Award XP
    const xpResult = this.gamification.awardXP(4, score);

    // Update nav
    this.updateNavStats();

    // Add practice time
    this.storage.addDailyPracticeTime(duration / 60);

    // Show results
    const resultsSection = document.getElementById('wordResultsSection');
    const resultsContent = document.getElementById('wordResultsContent');
    const resultTitle = document.getElementById('wordResultTitle');

    resultTitle.textContent = passed ? '✅ Passed!' : '❌ Try Again';
    resultTitle.style.color = passed ? 'var(--color-success)' : 'var(--color-danger)';

    resultsContent.innerHTML = `
      <div class="live-stats">
        <div class="stat-box">
          <span class="stat-label">Pitch Stability</span>
          <span class="stat-value">${avgPitchStdDev.toFixed(1)} Hz</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Resonance Stability</span>
          <span class="stat-value">${avgResonanceStability.toFixed(1)}%</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Score</span>
          <span class="stat-value highlight-primary">${score}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">获得经验</span>
          <span class="stat-value highlight-success">+${xpResult.xpGained}</span>
        </div>
      </div>
      <p style="margin-top: 1rem; text-align: center;">
        ${passed ? 'Great job! Your pitch and resonance were stable.' : 'Keep practicing! Aim for <10Hz pitch std dev and <10% resonance stability.'}
      </p>
    `;

    resultsSection.style.display = 'block';
  }

  // Achievements
  renderAchievements() {
    const container = document.getElementById('achievementsList');
    container.innerHTML = '';

    const allAchievements = this.gamification.getAllAchievements();
    const unlockedAchievements = this.gamification.getUnlockedAchievements();
    const unlockedIds = unlockedAchievements.map(a => a.id);

    allAchievements.forEach(achievement => {
      const isUnlocked = unlockedIds.includes(achievement.id);

      const card = document.createElement('div');
      card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <h4>${achievement.name}</h4>
        <p>${achievement.description}</p>
        <div class="xp-reward">+${achievement.xpReward} XP</div>
      `;

      container.appendChild(card);
    });
  }

  showAchievementNotification(achievement) {
    const notification = document.getElementById('achievementNotification');
    document.getElementById('achievementIcon').textContent = achievement.icon;
    document.getElementById('achievementTitle').textContent = achievement.name;
    document.getElementById('achievementDescription').textContent = achievement.description;

    notification.classList.add('show');

    setTimeout(() => {
      notification.classList.remove('show');
    }, 5000);
  }

  // Progress
  renderProgress() {
    const history = this.storage.getHistory();
    const gamification = this.storage.getGamification();
    const settings = this.storage.getSettings();
    const targetHz = settings.targetFrequency;

    // ---- 1. Feminization Gauge (circular %) ----
    const gaugeCanvas = document.getElementById('femGaugeCanvas');
    if (gaugeCanvas) {
      // Calculate feminization %: map 85-255Hz → 0-100%
      const allPitches = history.pitchHistory.map(h => h.avgPitch).filter(p => p > 0);
      const recentAvg = allPitches.length > 0 
        ? allPitches.slice(-5).reduce((a,b)=>a+b,0) / Math.min(5, allPitches.length)
        : 0;
      // Male 85Hz = 0%, Female 255Hz = 100%, linear interpolation
      const femPct = recentAvg > 0 ? Math.round(Math.min(100, Math.max(0, ((recentAvg - 85) / (255 - 85)) * 100))) : 0;
      this.charts.drawFeminizationGauge(gaugeCanvas, femPct, '女性化指数');
    }

    // ---- 2. Daily stats ----
    const dailyStats = document.getElementById('dailyStatsContent');
    if (dailyStats) {
      const today = new Date().toDateString();
      const todayMin = gamification.dailyPracticeMinutes[today] || 0;
      const allDays = Object.keys(gamification.dailyPracticeMinutes);
      const totalDays = allDays.length;
      const totalMin = Object.values(gamification.dailyPracticeMinutes).reduce((a,b)=>a+b,0);
      const lastPitch = history.pitchHistory.length > 0 
        ? history.pitchHistory[history.pitchHistory.length - 1].avgPitch.toFixed(1) 
        : '--';
      dailyStats.innerHTML = `
        <div>🎤 最近音高：<b style="color:#00d9ff">${lastPitch} Hz</b></div>
        <div>📅 累计天数：<b>${totalDays} 天</b></div>
        <div>⏱️ 总练习：<b>${Math.round(totalMin)} 分钟</b></div>
        <div>🔥 连续打卡：<b>${gamification.streak} 天</b></div>
        <div>🏆 成就解锁：<b>${gamification.achievements.length} 个</b></div>
        <div>💪 今日已练：<b>${Math.round(todayMin)} 分钟</b></div>
      `;
    }

    // ---- 3. Feminization Journey (trend line) ----
    const journeyCanvas = document.getElementById('femJourneyCanvas');
    if (journeyCanvas) {
      // Build daily averages from pitchHistory grouped by date
      const pitchByDate = {};
      history.pitchHistory.forEach(h => {
        const d = new Date(h.timestamp).toDateString();
        if (!pitchByDate[d]) pitchByDate[d] = [];
        pitchByDate[d].push(h.avgPitch);
      });
      const dailyAverages = Object.entries(pitchByDate)
        .sort((a,b) => new Date(a[0]) - new Date(b[0]))
        .slice(-90) // last 90 days
        .map(([date, pitches]) => ({
          date: new Date(date).toLocaleDateString('zh-CN', {month:'short',day:'numeric'}),
          hz: pitches.reduce((a,b)=>a+b,0) / pitches.length
        }));
      
      const currentAvg = history.pitchHistory.length > 0
        ? history.pitchHistory.slice(-3).reduce((a,h)=>a+h.avgPitch,0) / Math.min(3, history.pitchHistory.length)
        : 0;
      
      this.charts.drawFeminizationJourney(journeyCanvas, currentAvg, dailyAverages, targetHz);
    }

    // ---- 4. Pitch history chart ----
    const pitchCanvas = document.getElementById('pitchHistoryCanvas');
    if (pitchCanvas && history.pitchHistory.length > 0) {
      const data = history.pitchHistory.map((h, i) => ({
        label: i.toString(),
        value: h.avgPitch
      }));
      this.charts.drawLineChart(pitchCanvas, data, 'Pitch Over Time', settings.targetFrequency);
    }

    // Resonance history chart
    const resonanceCanvas = document.getElementById('resonanceHistoryCanvas');
    if (resonanceCanvas && history.resonanceHistory.length > 0) {
      const data = history.resonanceHistory.map((h, i) => ({
        label: i.toString(),
        value: h.stability
      }));
      this.charts.drawLineChart(resonanceCanvas, data, 'Resonance Stability Over Time', 10);
    }

    // Statistics
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';

    const progress = this.storage.getProgress();

    const stats = [
      { label: 'Total Sessions', value: history.sessions.length },
      { label: 'Section I Attempts', value: progress.section1Stats.attempts },
      { label: 'Section II Sessions', value: progress.section2Stats.completedSessions },
      { label: 'Section III Attempts', value: progress.section3Stats.attempts },
      { label: 'Achievements Unlocked', value: gamification.achievements.length },
      { label: 'Total XP', value: gamification.totalXp },
      { label: 'Longest Streak', value: `${gamification.longestStreak} days` }
    ];

    stats.forEach(stat => {
      const box = document.createElement('div');
      box.className = 'stat-box';
      box.innerHTML = `
        <span class="stat-label">${stat.label}</span>
        <span class="stat-value">${stat.value}</span>
      `;
      statsGrid.appendChild(box);
    });
  }

  // Settings
  update目标Note() {
    const noteSelect = document.getElementById('noteSelect');
    const note = noteSelect.value;

    const pitchDetector = new PitchDetector();
    const noteMap = {
      'C3': ['C', 3], 'C#3': ['C#', 3], 'D3': ['D', 3], 'D#3': ['D#', 3],
      'E3': ['E', 3], 'F3': ['F', 3], 'F#3': ['F#', 3], 'G3': ['G', 3],
      'G#3': ['G#', 3], 'A3': ['A', 3], 'A#3': ['A#', 3], 'B3': ['B', 3],
      'C4': ['C', 4]
    };

    const [noteName, octave] = noteMap[note];
    const frequency = pitchDetector.noteToFrequency(noteName, octave);

    this.storage.updateSettings({
      targetNote: note,
      targetFrequency: frequency
    });

    alert(`目标 note updated to ${note} (${frequency.toFixed(2)} Hz)`);
  }

  toggleDarkMode() {
    const enabled = document.getElementById('darkModeToggle').checked;
    this.storage.updateSettings({ darkMode: enabled });
    // In a real implementation, you'd toggle CSS classes here
  }

  toggleNotifications() {
    const enabled = document.getElementById('notificationsToggle').checked;
    this.storage.updateSettings({ notificationsEnabled: enabled });
  }

  exportData() {
    const data = this.storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voice-trainer-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = this.storage.importData(event.target.result);
        if (success) {
          alert('Data imported successfully!');
          this.loadProgress();
          this.updateNavStats();
        } else {
          alert('Failed to import data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  resetProgress() {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      this.storage.resetProgress();
      alert('Progress reset successfully.');
      location.reload();
    }
  }

  // AI Coach tips rendering
  renderCoachTips(containerId, tips) {
    const container = document.getElementById(containerId);
    if (!container || !tips || tips.length === 0) return;
    container.innerHTML = tips.map(t => {
      const bgMap = { error: 'rgba(255,71,87,0.1)', warn: 'rgba(255,165,2,0.1)', success: 'rgba(46,213,115,0.1)', info: 'rgba(0,217,255,0.1)' };
      const borderMap = { error: '#ff4757', warn: '#ffa502', success: '#2ed573', info: '#00d9ff' };
      return `<div style="padding:8px 12px;margin:6px 0;border-radius:8px;background:${bgMap[t.severity]};border-left:3px solid ${borderMap[t.severity]};font-size:13px;line-height:1.5;">
        <span style="font-size:16px;">${t.icon}</span> ${t.message}
      </div>`;
    }).join('');
  }

  showBreakAlert(alert) {
    // Show as a non-intrusive toast notification
    const toast = document.createElement('div');
    const bgMap = { error: 'rgba(255,71,87,0.95)', warn: 'rgba(255,165,2,0.95)', info: 'rgba(0,217,255,0.95)' };
    toast.style.cssText = `position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;
      padding:12px 20px;border-radius:10px;background:${bgMap[alert.severity]||'#333'};color:#fff;
      font-size:14px;max-width:340px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);
      animation:fadeInDown 0.3s ease;cursor:pointer;`;
    toast.textContent = `${alert.icon} ${alert.message}`;
    toast.onclick = () => toast.remove();
    document.body.appendChild(toast);
    // Auto-remove after 6 seconds for non-critical alerts
    if (alert.severity !== 'error') {
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
    }
    // If action=stop, also auto-stop the exercise
    if (alert.action === 'stop') {
      setTimeout(() => this.stopSongTraining(), 2000);
    }
  }

  // Section 5: Song Graded Training
  renderSection5() {
    const st = this.storage.getSongTraining();
    this.songSelectLevel = st.currentLevel;
    this.selectedSongId = null;
    this.updateSongLevelTabs();
    this.selectSongLevel(this.songSelectLevel);
  }

  updateSongLevelTabs() {
    const st = this.storage.getSongTraining();
    document.querySelectorAll('.level-tab').forEach(tab => {
      const lv = parseInt(tab.dataset.lv);
      tab.classList.remove('active', 'locked');
      if (lv === this.songSelectLevel) tab.classList.add('active');
      else if (lv > st.currentLevel) tab.classList.add('locked');
    });
  }

  selectSongLevel(level) {
    const st = this.storage.getSongTraining();
    if (level > st.currentLevel) return; // locked
    this.songSelectLevel = level;
    this.selectedSongId = null;
    this.updateSongLevelTabs();
    this.renderSongGrid(level);
    this.updateSongLevelInfo(level);
  }

  renderSongGrid(level) {
    const grid = document.getElementById('songGrid');
    const songs = this.songTrainer.getSongsForLevel(level);
    const st = this.storage.getSongTraining();
    const completed = st.completedSongs;

    grid.innerHTML = songs.map(s => {
      const done = completed[s.id];
      const bg = done ? 'rgba(22,199,154,0.2)' : '';
      const border = done ? '1px solid rgba(22,199,154,0.5)' : '';
      return `<div class="song-card" data-song="${s.id}" 
        style="padding:10px;border-radius:8px;cursor:pointer;background:${bg};border:${border};text-align:center;"
        onclick="app.selectSong('${level}','${s.id}')">
        <div style="font-weight:bold;font-size:14px;">${done?'✅ ':''}${s.title}</div>
        <div style="font-size:11px;color:#a4b0be;">${s.artist} · ${s.key}调</div>
        <div style="font-size:10px;color:#00d9ff;margin-top:2px;">💡 ${s.hint}</div>
      </div>`;
    }).join('');
  }

  updateSongLevelInfo(level) {
    const info = this.songTrainer.getLevelInfo(level);
    const st = this.storage.getSongTraining();
    const stats = st.levelStats[level];
    document.getElementById('songLevelInfo').innerHTML = `
      <h3 style="color:${info.color}">Lv.${level} ${info.name} <span style="font-size:14px;color:#a4b0be;">${info.note} (${info.range[0]}-${info.range[1]}Hz)</span></h3>
      <p style="color:#a4b0be;font-size:13px;">${info.desc}</p>
      <p style="font-size:12px;">已完成 ${stats.completed}/4 首 | 尝试 ${stats.attempts} 次</p>
    `;
  }

  selectSong(level, songId) {
    this.songSelectLevel = level;
    this.selectedSongId = songId;
    // Reset audio state
    if (this.karaoke) this.karaoke._stopAudio();
    document.getElementById('songPreviewBtn').textContent = '🔊 试听原唱';
    document.getElementById('songPreviewBtn').style.color = '';
    // Highlight selected
    document.querySelectorAll('.song-card').forEach(c => {
      c.style.outline = c.dataset.song === songId ? '2px solid #ffd700' : 'none';
    });
    // Load lyrics via LRCPlayer
    const song = this.songTrainer.findSong(level, songId);
    const lyricsEl = document.getElementById('songLyricsBox');
    lyricsEl.style.display = 'block';
    lyricsEl.innerHTML = '<div style="color:#a4b0be;text-align:center;padding:40px;">⏳ 正在加载歌词...</div>';
    
    // Try LRCLIB API first, fallback to embedded lyrics
    this.lrcPlayer.fetchLRC(song.artist, song.title).then(lrc => {
      if (lrc) {
        this.lrcPlayer.load(lrc);
        this._songLrcSource = 'lrc';
      } else if (song.lyrics) {
        this.lrcPlayer.load(song.lyrics);
        this._songLrcSource = 'text';
      } else {
        this.lrcPlayer.load(null);
        this._songLrcSource = 'none';
      }
      // Pre-render the lyrics
      this.lrcPlayer.container = lyricsEl;
      this.lrcPlayer.render();
    });
    // Fetch preview URL
    this.lrcPlayer.fetchPreviewUrl(song.artist, song.title).then(url => {
      this._songPreviewUrl = url;
      document.getElementById('songPreviewBtn').style.display = url ? 'inline-block' : 'none';
    });
  }

    async startSongTraining() {
    if (!this.selectedSongId) {
      alert('请先选择一首歌曲！');
      return;
    }
    const song = this.songTrainer.findSong(this.songSelectLevel, this.selectedSongId);
    if (!song || !song.melody || song.melody.length === 0) {
      alert('该歌曲暂不支持 K 歌模式');
      return;
    }
    // Load melody into karaoke engine
    this.karaoke.loadMelody(song.melody, song.melodyDuration || 20, song.bpm || 80);
    // 尝试加载 MP3 伴奏
    const mp3Paths = [
      `/sdcard/Music/vt_songs/${song.id}.mp3`,
      `/sdcard/Download/jianyin/${song.title}-${song.artist}/${song.title}.mp3`,
      `/sdcard/Download/${song.title} - ${song.artist}.mp3`,
      `/sdcard/Music/${song.title}.mp3`
    ];
    let audioLoaded = false;
    for (const path of mp3Paths) {
      try {
        await this.karaoke.loadAudioFile('file://' + path);
        console.log('MP3 loaded:', path);
        document.getElementById('songPreviewBtn').textContent = '🎵 伴奏已加载';
        document.getElementById('songPreviewBtn').style.display = 'inline-block';
        document.getElementById('songPreviewBtn').style.color = '#16c79a';
        audioLoaded = true;
        break;
      } catch(e) { /* file not found */ }
    }
    if (!audioLoaded) {
      document.getElementById('songPreviewBtn').textContent = '📁 选取伴奏';
      document.getElementById('songPreviewBtn').style.display = 'inline-block';
      document.getElementById('songPreviewBtn').style.color = '';
    }
    // Setup karaoke callbacks
    this._setupKaraokeCallbacks(song);
    // Show full-screen overlay
    const overlay = document.getElementById('karaokeOverlay');
    overlay.style.display = 'flex';
    document.getElementById('karaokeSongTitle').textContent = song.title;
    document.getElementById('karaokeArtist').textContent = song.artist + ' · ' + song.key + '调';
    document.getElementById('karaokeScore').textContent = '0';
    document.getElementById('karaokeCombo').textContent = '';
    // Render lyrics in karaoke mode
    this._renderKaraokeLyrics(song.lyrics);
    // Attach canvas
    this.karaoke.attachCanvas(document.getElementById('karaokePitchCanvas'));
    // Start mic + karaoke engine
    this.currentExercise = 'karaoke';
    this._songStartTime = Date.now();
    this._karaokeTimerInterval = setInterval(() => {
      const elapsed = this.karaoke.getElapsedMs();
      const sec = Math.floor(elapsed / 1000);
      document.getElementById('ksTimer').textContent = 
        String(Math.floor(sec/60)).padStart(2,'0') + ':' + String(sec%60).padStart(2,'0');
    }, 200);
    this.karaoke.start();
    this.audioManager.startRecording((audioData) => {
      if (!this.karaoke.isActive) return;
      try {
        const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);
        if (pitch && pitch > 50) {
          const avg = this.pitchDetector.getAveragePitch(5);
          this.karaoke.feedPitch(avg || pitch);
        }
      } catch(e) {}
    });
    // Toggle buttons
    document.getElementById('startSongBtn').style.display = 'none';
    document.getElementById('stopSongBtn').style.display = 'inline-block';
  }

  _setupKaraokeCallbacks(song) {
    this.karaoke.onScoreEffect = (fx) => this._showKaraokeScoreEffect(fx);
    this.karaoke.onLyricChange = (info) => this._highlightKaraokeLyric(info);
    this.karaoke.onStatsUpdate = (s) => {
      document.getElementById('karaokeScore').textContent = s.score;
      document.getElementById('karaokeCombo').textContent = s.combo > 1 ? s.combo + '连击!' : '';
      document.getElementById('ksPerfect').textContent = s.perfect;
      document.getElementById('ksGood').textContent = s.good;
      document.getElementById('ksMiss').textContent = s.miss;
    };
  }

  _renderKaraokeLyrics(lyrics) {
    const lines = lyrics.split('\\n').filter(l => l.trim());
    const container = document.getElementById('karaokeLyrics');
    // 每行逐字渲染
    container.innerHTML = lines.map((line, li) => {
      const chars = [...line];
      const spans = chars.map((ch, ci) => 
        `<span class="kl-char" data-kl-li="${li}" data-kl-ci="${ci}" style="color:#555;transition:color 0.15s,text-shadow 0.15s;">${ch}</span>`
      ).join('');
      return `<div class="kl-line" data-kl-idx="${li}" style="margin:2px 0;">${spans}</div>`;
    }).join('');
    this._karaokeLyricLines = container.querySelectorAll('.kl-line');
  }

  _highlightKaraokeLyric(info) {
    // info = {lyricIdx, syllableIdx}
    if (!this._karaokeLyricLines) return;
    const li = info.lyricIdx;
    const si = info.syllableIdx;
    // 遍历所有字符span，设置状态
    const allChars = document.querySelectorAll('#karaokeLyrics .kl-char');
    allChars.forEach(el => {
      const elLi = parseInt(el.dataset.klLi);
      const elCi = parseInt(el.dataset.klCi);
      el.style.color = '#555';
      el.style.textShadow = 'none';
      el.style.fontWeight = 'normal';
      el.style.fontSize = '';
      if (elLi < li || (elLi === li && elCi < si)) {
        // 已唱过的字
        el.style.color = '#a4b0be';
        el.style.opacity = '0.7';
      } else if (elLi === li && elCi === si) {
        // 当前字：金色高亮
        el.style.color = '#ffd700';
        el.style.textShadow = '0 0 10px rgba(255,215,0,0.8)';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '1.1em';
        el.style.opacity = '1';
      }
      // 未来的字保持暗色
    });
    // 滚动当前行到中间
    if (this._karaokeLyricLines[li]) {
      this._karaokeLyricLines[li].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  _showKaraokeScoreEffect(fx) {
    const layer = document.getElementById('karaokeFxLayer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'karaoke-fx ' + fx.type;
    el.textContent = fx.text;
    el.style.left = (Math.random() * 60 - 30) + 'px';
    layer.appendChild(el);
    if (fx.combo > 1) {
      const cb = document.createElement('div');
      cb.className = 'karaoke-fx combo';
      cb.textContent = fx.combo + '连击!';
      layer.appendChild(cb);
      setTimeout(() => cb.remove(), 1500);
    }
    setTimeout(() => el.remove(), 1500);
  }

  async pickAudioFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await this.karaoke.loadAudioFile(file);
        document.getElementById('songPreviewBtn').textContent = '🎵 伴奏已加载';
        document.getElementById('songPreviewBtn').style.color = '#16c79a';
        document.getElementById('songPreviewBtn').style.display = 'inline-block';
      } catch(err) {
        alert('音频加载失败: ' + err.message);
      }
    };
    input.click();
  }

  toggleKaraokePause() {
    if (!this.karaoke) return;
    if (this.karaoke.isPaused) {
      this.karaoke.resume();
      document.getElementById('karaokePauseBtn').textContent = '⏯ 暂停';
    } else {
      this.karaoke.pause();
      document.getElementById('karaokePauseBtn').textContent = '▶ 继续';
    }
  }

  toggleKaraokeGuide() {
    this._karaokeGuideOn = !this._karaokeGuideOn;
    document.getElementById('karaokeGuideToggle').textContent = 
      this._karaokeGuideOn ? '🔔 导唱: 开' : '🔕 导唱: 关';
  }

  toggleKaraokeBeat() {
    this._karaokeBeatOn = !this._karaokeBeatOn;
    if (this.karaoke) this.karaoke.setBeatOn(this._karaokeBeatOn);
    document.getElementById('karaokeBeatToggle').textContent = 
      this._karaokeBeatOn ? '🥁 节拍: 开' : '🔇 节拍: 关';
  }

  stopSongTraining() {
    this.audioManager.stopRecording();
    if (this._karaokeTimerInterval) { clearInterval(this._karaokeTimerInterval); }
    // Stop karaoke engine
    const result = this.karaoke.isActive ? this.karaoke.stop() : null;
    // Hide overlay
    document.getElementById('karaokeOverlay').style.display = 'none';
    document.getElementById('startSongBtn').style.display = 'inline-block';
    document.getElementById('stopSongBtn').style.display = 'none';
    // Show results
    if (result) {
      this._showKaraokeResults(result);
    }
  }

  _showKaraokeResults(r) {
    const rs = document.getElementById('songResultsSection');
    const rc = document.getElementById('songResultsContent');
    rc.innerHTML = `
      <div class="live-stats">
        <div class="stat-box"><span class="stat-label">总分</span><span class="stat-value highlight-primary">${r.score}</span></div>
        <div class="stat-box"><span class="stat-label">完美率</span><span class="stat-value">${r.pct}%</span></div>
        <div class="stat-box"><span class="stat-label">完美</span><span class="stat-value" style="color:#ffd700">${r.perfect}</span></div>
        <div class="stat-box"><span class="stat-label">优秀</span><span class="stat-value" style="color:#16c79a">${r.good}</span></div>
        <div class="stat-box"><span class="stat-label">失误</span><span class="stat-value" style="color:#ff4757">${r.miss}</span></div>
        <div class="stat-box"><span class="stat-label">最大连击</span><span class="stat-value" style="color:#ffd700">${r.maxCombo}</span></div>
      </div>
    `;
    rs.style.display = 'block';
  }

  playSongPreview() {
    // 如果当前是「选取伴奏」模式
    const btn = document.getElementById('songPreviewBtn');
    if (btn && btn.textContent.includes('选取伴奏')) {
      this.pickAudioFile();
      return;
    }
    if (!this._songPreviewUrl) return;
    if (this._previewAudio) { this._previewAudio.pause(); }
    this._previewAudio = new Audio(this._songPreviewUrl);
    this._previewAudio.play();
    document.getElementById('songPreviewBtn').style.display = 'none';
    document.getElementById('songPreviewStopBtn').style.display = 'inline-block';
    this._previewAudio.onended = () => this.stopSongPreview();
  }

  stopSongPreview() {
    if (this._previewAudio) {
      this._previewAudio.pause();
      this._previewAudio = null;
    }
    document.getElementById('songPreviewBtn').style.display = 'inline-block';
    document.getElementById('songPreviewStopBtn').style.display = 'none';
  }


  // Section 6: AI Conversation Coach
  renderSection6() {
    this._convMode = 'd1';
    this._showConvDefaultMode();
  }

  _showConvDefaultMode() {
    // Show original conversation coach UI
    const els = ['convDefaultArea', 'conv-display', 'convFreeArea'];
    document.querySelectorAll('.conv-display, #convPitchCanvas, #convLiveHint, .live-stats, .controls, #convResultsSection').forEach(el => {
      if (el && el.closest('#convFreeArea') === null) el.style.display = '';
    });
    const freeArea = document.getElementById('convFreeArea');
    if (freeArea) freeArea.style.display = 'none';
    // Show buttons
    document.getElementById('startConvBtn').style.display = 'inline-block';
    document.getElementById('stopConvBtn').style.display = 'none';
    document.getElementById('nextConvBtn').style.display = 'none';
    document.getElementById('convResultsSection').style.display = 'none';

    this._convMode = 'd1';
    this.convLevel = 1;
    this.updateConvLevelTabs();
    this.loadConvDialog();
    if (this.liveMonitor) { this.liveMonitor.stop(); this.liveMonitor = null; }
  }

  _showConvFreeMode() {
    // Hide original UI
    document.querySelectorAll('.conv-display, #convPitchCanvas, #convLiveHint, .live-stats').forEach(el => {
      if (el && el.closest('#convFreeArea') === null) el.style.display = 'none';
    });
    document.getElementById('startConvBtn').style.display = 'none';
    document.getElementById('stopConvBtn').style.display = 'none';
    document.getElementById('nextConvBtn').style.display = 'none';
    document.getElementById('convResultsSection').style.display = 'none';
    // Show free chat area
    const freeArea = document.getElementById('convFreeArea');
    if (freeArea) freeArea.style.display = '';
    document.getElementById('startFreeChatBtn').style.display = 'inline-block';
    document.getElementById('stopFreeChatBtn').style.display = 'none';
    document.getElementById('freeChatStats').textContent = '';

    this._convMode = 'free';
    this.updateConvLevelTabs();
  }

  selectConvMode(mode) {
    if (mode === 'free') {
      this._showConvFreeMode();
    } else {
      // D1/D2/D3
      this.convLevel = mode === 'd1' ? 1 : mode === 'd2' ? 2 : 3;
      this._showConvDefaultMode();
      this.convCoach.startSession(this.convLevel);
      this.loadConvDialog();
    }
  }

  updateConvLevelTabs() {
    document.querySelectorAll('.conv-level-tabs .level-tab').forEach(tab => {
      const lv = tab.dataset.lv;
      if (this._convMode === 'free') {
        tab.classList.toggle('active', lv === 'free');
      } else {
        const lvNum = this._convMode === 'd1' ? 1 : this._convMode === 'd2' ? 2 : 3;
        tab.classList.toggle('active', parseInt(lv) === lvNum);
      }
    });
  }

  selectConvLevel(level) {
    this.convLevel = level;
    this._convMode = level === 1 ? 'd1' : level === 2 ? 'd2' : 'd3';
    this.convCoach.startSession(level);
    this.updateConvLevelTabs();
    this.loadConvDialog();
  }

  loadConvDialog() {
    const d = this.convCoach.getCurrentDialog();
    if (!d) return;
    document.getElementById('convAIText').textContent = `"${d.text}"`;
    document.getElementById('convHint').textContent = `💡 ${d.hint}`;
    document.getElementById('convReplyHint').textContent = `→ ${d.reply}`;
  }

  async playConvAudio() {
    const d = this.convCoach.getCurrentDialog();
    if (!d) return;
    const btn = document.getElementById('convPlayBtn');
    btn.disabled = true;
    btn.textContent = '🔊 播放中...';
    await this.convCoach.speak(d.text);
    btn.disabled = false;
    btn.textContent = '🔊 播放女声';
  }

  async startConvTraining() {
    const d = this.convCoach.getCurrentDialog();
    if (!d) return;
    
    document.getElementById('startConvBtn').style.display = 'none';
    document.getElementById('stopConvBtn').style.display = 'inline-block';
    document.getElementById('nextConvBtn').style.display = 'none';
    document.getElementById('convResultsSection').style.display = 'none';

    this.currentExercise = 'conversation';
    this.pitchDetector.clearHistory();
    this.convCoach.startSession(this.convLevel);
    this.loadConvDialog();

    // First play the reference audio
    await this.convCoach.speak(d.text);

    // Now start recording for user's turn
    const info = this.convCoach.getLevelInfo(this.convLevel);
    const range = info.range;
    this._convPitchBuf = [];

    this.audioManager.startRecording((audioData) => {
      const pitch = this.pitchDetector.detectPitch(audioData.timeDomainData);
      if (pitch) {
        const avgPitch = this.pitchDetector.getAveragePitch(5);
        const result = this.convCoach.feedPitch(avgPitch);

        document.getElementById('convCurrentPitch').textContent = `${avgPitch.toFixed(1)} Hz`;
        document.getElementById('convMatchPct').textContent = `${result.rangePct}%`;

        const statusMap = { excellent:'✅ 完美！', good:'👍 不错', too_low:'⬇️ 偏低', too_high:'⬆️ 偏高', no_signal:'🔇' };
        document.getElementById('convStatus').textContent = statusMap[result.status] || '--';

        const hint = this.aiCoach.getLiveHint(avgPitch, range[0], range[1], result.status);
        document.getElementById('convLiveHint').innerHTML = `<span style="color:${hint.color}">${hint.icon} ${hint.text}</span>`;

        this._convPitchBuf.push(avgPitch);
        if (this._convPitchBuf.length > 60) this._convPitchBuf.shift();

        const canvas = document.getElementById('convPitchCanvas');
        if (canvas) this.charts.drawSongPitchTracker(canvas, avgPitch, range[0], range[1], this._convPitchBuf);
      }
    });
  }

  stopConvTraining() {
    this.audioManager.stopRecording();
    const result = this.convCoach.stopSession();

    document.getElementById('startConvBtn').style.display = 'inline-block';
    document.getElementById('stopConvBtn').style.display = 'none';
    document.getElementById('nextConvBtn').style.display = 'inline-block';

    document.getElementById('convResultsContent').innerHTML = `
      <div class="live-stats">
        <div class="stat-box"><span class="stat-label">匹配度</span><span class="stat-value highlight-primary">${result.accuracy}%</span></div>
        <div class="stat-box"><span class="stat-label">得分</span><span class="stat-value">${result.score}</span></div>
      </div>
    `;
    document.getElementById('convResultsSection').style.display = 'block';
  }

  nextConvDialog() {
    this.convCoach.nextDialog();
    this.loadConvDialog();
    document.getElementById('convResultsSection').style.display = 'none';
    document.getElementById('nextConvBtn').style.display = 'none';
    document.getElementById('convCurrentPitch').textContent = '-- Hz';
    document.getElementById('convMatchPct').textContent = '0%';
    document.getElementById('convStatus').textContent = '就绪';
    document.getElementById('convLiveHint').innerHTML = '';
  }

  // ===== 豆包API Key 设置 =====

  setDoubaoKey() {
    const input = document.getElementById('doubaoKeyInput');
    const status = document.getElementById('doubaoStatus');
    const key = (input.value || '').trim();
    if (key) {
      this.doubaoAPI.setAPIKey(key);
      status.textContent = '✅ Key已保存，重启对话生效';
      status.style.color = '#00ff88';
      // 回填输入框（显示已保存）
      input.value = key.slice(0, 8) + '***' + key.slice(-4);
      setTimeout(function() { input.value = key; }, 2000);
    } else {
      status.textContent = '';
    }
  }

  // ===== 自由对话模式 =====

  startFreeChat() {
    document.getElementById('startFreeChatBtn').style.display = 'none';
    document.getElementById('stopFreeChatBtn').style.display = 'inline-block';
    document.getElementById('chatInputArea').style.display = 'block';

    // 开始API会话
    this.doubaoAPI.startSession();
    this._freeChatMsgs = [];

    // 初始化音高监控
    if (!this.liveMonitor) {
      const canvas = document.getElementById('chatPitchCanvas');
      if (canvas) {
        canvas.width = canvas.parentElement.clientWidth || 400;
        canvas.height = 60;
      }
      this.liveMonitor = new LivePitchMonitor(this.audioManager, this.pitchDetector);
      if (canvas) this.liveMonitor.attachCanvas(canvas);
      const status = this.coachStrategy.getStatus();
      this.liveMonitor.setTarget(status.targetMin, status.targetMax);
      this.liveMonitor.start();
      const self = this;
      // 定期更新音高标签
      this._pitchInterval = setInterval(function() {
        const s = self.liveMonitor._getSessionStats();
        const label = document.getElementById('chatPitchLabel');
        if (label && s.avgFreq > 0) label.textContent = Math.round(s.avgFreq) + ' Hz';
      }, 500);
    }

    // 更新在线状态
    this._updateChatOnlineBadge();

    // 欢迎消息
    this._addChatBubble('ai', '嗨～我是你的嗓音教练，也是你的聊天伙伴！随便聊聊吧，我会在聊天中帮你注意发声状态 💕');
    this._scrollChatBottom();

    // 聚焦输入框
    setTimeout(function() {
      const inp = document.getElementById('chatInput');
      if (inp) inp.focus();
    }, 300);
  }

  stopFreeChat() {
    document.getElementById('startFreeChatBtn').style.display = 'inline-block';
    document.getElementById('stopFreeChatBtn').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('chatPitchLabel').textContent = '-- Hz';
    if (this.liveMonitor) {
      this.liveMonitor.stop();
      this.liveMonitor = null;
    }
    if (this._pitchInterval) { clearInterval(this._pitchInterval); this._pitchInterval = null; }
    this._freeChatMsgs = [];
  }

  sendChatMsg() {
    const input = document.getElementById('chatInput');
    const msg = (input.value || '').trim();
    if (msg.length === 0) return;
    input.value = '';
    input.disabled = true;
    document.getElementById('chatSendBtn').disabled = true;

    this._addChatBubble('user', msg);
    this._scrollChatBottom();

    // 构建对话历史
    const history = [];
    for (let i = Math.max(0, this._freeChatMsgs.length - 10); i < this._freeChatMsgs.length; i++) {
      const m = this._freeChatMsgs[i];
      if (m.role === 'user') history.push({ role: 'user', content: m.text });
      else if (m.role === 'ai') history.push({ role: 'assistant', content: m.text });
    }

    const self = this;
    this.doubaoAPI.chat(msg, history).then(function(reply) {
      self._addChatBubble('ai', reply.text, reply.offline);
      self._scrollChatBottom();
      input.disabled = false;
      document.getElementById('chatSendBtn').disabled = false;
      self._updateChatOnlineBadge();
    }).catch(function() {
      self._addChatBubble('ai', '抱歉，出了点问题，请稍后再试～');
      self._scrollChatBottom();
      input.disabled = false;
      document.getElementById('chatSendBtn').disabled = false;
    });
  }

  _addChatBubble(role, text, offline) {
    this._freeChatMsgs.push({ role: role, text: text, time: Date.now() });
    const el = document.getElementById('chatBubbles');
    if (!el) return;

    const bubble = document.createElement('div');
    if (role === 'user') {
      bubble.style.cssText = 'align-self:flex-end;max-width:80%;background:rgba(0,217,255,0.2);border-radius:14px 14px 4px 14px;padding:8px 14px;color:#fff;font-size:14px;word-break:break-word;';
      bubble.textContent = text;
    } else if (role === 'ai') {
      var tag = '';
      if (offline) tag = '<span style="font-size:10px;color:#666;"> [离线]</span>';
      bubble.style.cssText = 'align-self:flex-start;max-width:85%;background:rgba(255,255,255,0.06);border-radius:14px 14px 14px 4px;padding:8px 14px;color:#e0e0e0;font-size:14px;word-break:break-word;';
      bubble.innerHTML = '🤖 ' + text + tag;
    }
    el.appendChild(bubble);
    // 清空占位提示
    var ph = el.querySelector('div:first-child');
    if (ph && ph.style.textAlign === 'center' && ph.textContent.indexOf('开始聊天') > -1) {
      ph.remove();
    }
  }

  _scrollChatBottom() {
    const el = document.getElementById('chatBubbles');
    if (el) { setTimeout(function() { el.scrollTop = el.scrollHeight; }, 50); }
  }

  _updateChatOnlineBadge() {
    const badge = document.getElementById('chatOnlineBadge');
    if (!badge) return;
    if (this.doubaoAPI.isOnline() && this.doubaoAPI.hasAPIKey()) {
      badge.textContent = '🟢 在线 - 豆包教练';
      badge.style.color = '#16c79a';
    } else if (this.doubaoAPI.hasAPIKey()) {
      badge.textContent = '🟡 离线降级';
      badge.style.color = '#ffa502';
    } else {
      badge.textContent = '⚪ 离线模式';
      badge.style.color = '#666';
    }
  }

  renderSection7() {
    this.selectedVoiceStyle = 'xiaoxiao';
    this._renderStudioList();
    this._updateStudioProgress();
  }

  _renderStudioList() {
    const list = document.getElementById('studioSentenceList');
    if (!list) return;
    const sentences = this.voiceStudio.sentences;
    list.innerHTML = sentences.map(s => {
      const recorded = this.voiceStudio.hasRecording(s.id);
      const converted = this.voiceStudio.recordings[s.id + '_converted'];
      const statusIcon = converted ? '✅' : recorded ? '🎙️' : '⭕';
      const statusColor = converted ? '#2ed573' : recorded ? '#ffa502' : '#555';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #2a2a3e;">
        <span style="color:${statusColor};font-size:16px;width:24px;text-align:center;">${statusIcon}</span>
        <span style="color:#a4b0be;font-size:11px;min-width:28px;">[${s.level}]</span>
        <span style="color:#fff;font-size:13px;flex:1;">${s.text}</span>
        <button class="btn btn-sm btn-outline" onclick="app._studioRecord('${s.id}')" 
          style="font-size:11px;padding:4px 8px;${this.voiceStudio.isRecording ? 'opacity:0.5;pointer-events:none' : ''}">
          ${recorded ? '🔁 重录' : '🎤 录制'}
        </button>
        ${recorded ? `<button class="btn btn-sm btn-outline" onclick="app._studioPlay('${s.id}')" style="font-size:11px;padding:4px 8px;">▶ 试听</button>` : ''}
        ${converted ? `<button class="btn btn-sm btn-outline" onclick="app._studioPlayConv('${s.id}')" style="font-size:11px;padding:4px 8px;">👩 女声</button>` : ''}
      </div>`;
    }).join('');
  }

  async _studioRecord(sentenceId) {
    if (this.voiceStudio.isRecording) {
      await this.voiceStudio.stopRecording();
      this._renderStudioList();
      this._updateStudioProgress();
      return;
    }
    const ok = await this.voiceStudio.startRecording(sentenceId);
    if (ok) {
      this._renderStudioList();
      // Auto-stop after 5 seconds
      setTimeout(async () => {
        if (this.voiceStudio.isRecording) {
          await this.voiceStudio.stopRecording();
          this._renderStudioList();
          this._updateStudioProgress();
        }
      }, 5000);
    }
  }

  _studioPlay(sentenceId) {
    const blob = this.voiceStudio.getRecording(sentenceId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  }

  _studioPlayConv(sentenceId) {
    this.voiceStudio.playConverted(sentenceId).catch(() => {
      alert('转换后的音频未找到。请先导入女声文件。');
    });
  }

  _updateStudioProgress() {
    const p = this.voiceStudio.getProgress();
    const bar = document.getElementById('studioProgressBar');
    const text = document.getElementById('studioProgressText');
    const exportBtn = document.getElementById('studioExportBtn');
    if (bar) bar.style.width = p.pct + '%';
    if (text) text.textContent = `${p.done}/${p.total}`;
    if (exportBtn) exportBtn.disabled = p.done === 0;
  }

  selectVoiceStyle(style) {
    this.selectedVoiceStyle = style;
    const desc = document.getElementById('voiceStyleDesc');
    const guide = document.getElementById('studioGuide');
    const info = this.voiceStudio.styles[style];
    if (desc) desc.textContent = info ? info.desc : '';
    
    if (style === 'xiaoxiao') {
      // Using Edge TTS - no conversion needed
      this.convCoach.setVoiceConfig({ voice: 'zh-CN-XiaoxiaoNeural', rate: 0.9, pitch: '+0Hz' });
      if (guide) guide.style.display = 'block';
      guide.querySelector('h4').textContent = '🤖 微软晓晓 — 即开即用';
    } else {
      // Custom voice style - requires RVC conversion
      if (guide) {
        guide.style.display = 'block';
        guide.querySelector('h4').textContent = `🔄 ${info.name} — 需要RVC转换`;
      }
    }
  }

  exportStudioRecordings() {
    const exports = this.voiceStudio.exportRecordings();
    if (exports.length === 0) {
      alert('还没有录制任何句子。请先录制。');
      return;
    }
    // Download each recording
    exports.forEach((exp) => {
      const a = document.createElement('a');
      a.href = exp.url;
      a.download = `${exp.id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  importStudioAudio() {
    document.getElementById('studioImportInput').click();
  }

  handleStudioImport(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    let imported = 0;
    Array.from(files).forEach(file => {
      // Try to match file name to sentence id
      const name = file.name.replace(/\.(mp3|wav|webm|ogg|m4a)$/i, '');
      const sentence = this.voiceStudio.sentences.find(s => s.id === name);
      if (sentence) {
        this.voiceStudio.importAudio(sentence.id, file);
        imported++;
      }
    });
    
    this.voiceStudio.saveConvertedReferences();
    this._renderStudioList();
    this._updateStudioProgress();
    
    alert(`已导入 ${imported} 个女声音频文件。\n\n回到 Section VI 对话教练，播放时会自动使用你导入的女声。`);
  }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new VoiceTrainerApp();
});
