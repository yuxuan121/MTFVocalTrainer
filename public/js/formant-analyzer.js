/**
 * Formant analysis wrapper for resonance measurement
 * Uses formantanalyzer library for LPC-based formant extraction
 */
class FormantAnalyzer {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.analyzer = null;
    this.formantHistory = [];
    this.maxHistorySize = 50;
  }

  initialize() {
    // Check if formantanalyzer library is loaded
    if (typeof FormantAnalyser !== 'undefined') {
      this.analyzer = new FormantAnalyser(this.sampleRate);
    } else {
      console.warn('FormantAnalyser library not loaded, using simplified analysis');
    }
  }

  analyzeFormants(buffer) {
    if (!this.analyzer && typeof FormantAnalyser !== 'undefined') {
      this.initialize();
    }

    let formants = null;

    if (this.analyzer) {
      try {
        // Convert Float32Array to regular array if needed
        const bufferArray = Array.from(buffer);

        // Get formant features
        const features = this.analyzer.get_formants(bufferArray);

        if (features && features.length > 0) {
          // features format: [F1_freq, F1_energy, F1_bandwidth, F2_freq, F2_energy, F2_bandwidth, F3_freq, F3_energy, F3_bandwidth]
          formants = {
            F1: {
              frequency: features[0],
              energy: features[1],
              bandwidth: features[2]
            },
            F2: {
              frequency: features[3],
              energy: features[4],
              bandwidth: features[5]
            },
            F3: {
              frequency: features[6],
              energy: features[7],
              bandwidth: features[8]
            }
          };

          this.formantHistory.push(formants);
          if (this.formantHistory.length > this.maxHistorySize) {
            this.formantHistory.shift();
          }
        }
      } catch (error) {
        console.error('Formant analysis error:', error);
      }
    } else {
      // Fallback: simplified spectral peak detection
      formants = this.simplifiedFormantDetection(buffer);
      if (formants) {
        this.formantHistory.push(formants);
        if (this.formantHistory.length > this.maxHistorySize) {
          this.formantHistory.shift();
        }
      }
    }

    return formants;
  }

  simplifiedFormantDetection(buffer) {
    // Simple FFT-based peak detection as fallback
    // This is less accurate but provides basic resonance info
    const fftSize = 2048;
    const magnitudes = new Array(fftSize / 2);

    // Simple magnitude spectrum
    for (let i = 0; i < fftSize / 2; i++) {
      magnitudes[i] = Math.abs(buffer[i] || 0);
    }

    // Find peaks in typical formant ranges
    const F1_range = [200, 1000];  // Hz
    const F2_range = [800, 3000];  // Hz
    const F3_range = [2000, 4000]; // Hz

    const F1 = this.findPeakInRange(magnitudes, F1_range);
    const F2 = this.findPeakInRange(magnitudes, F2_range);
    const F3 = this.findPeakInRange(magnitudes, F3_range);

    return {
      F1: { frequency: F1, energy: 0, bandwidth: 0 },
      F2: { frequency: F2, energy: 0, bandwidth: 0 },
      F3: { frequency: F3, energy: 0, bandwidth: 0 }
    };
  }

  findPeakInRange(magnitudes, range) {
    const [minHz, maxHz] = range;
    const minBin = Math.floor(minHz * magnitudes.length / (this.sampleRate / 2));
    const maxBin = Math.ceil(maxHz * magnitudes.length / (this.sampleRate / 2));

    let maxMag = 0;
    let maxBin_idx = minBin;

    for (let i = minBin; i < maxBin && i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMag) {
        maxMag = magnitudes[i];
        maxBin_idx = i;
      }
    }

    // Convert bin to frequency
    return (maxBin_idx * this.sampleRate / 2) / magnitudes.length;
  }

  getAverageFormants(samples = 10) {
    if (this.formantHistory.length === 0) return null;

    const recent = this.formantHistory.slice(-samples);

    const avgF1 = recent.reduce((sum, f) => sum + f.F1.frequency, 0) / recent.length;
    const avgF2 = recent.reduce((sum, f) => sum + f.F2.frequency, 0) / recent.length;
    const avgF3 = recent.reduce((sum, f) => sum + f.F3.frequency, 0) / recent.length;

    return {
      F1: avgF1,
      F2: avgF2,
      F3: avgF3
    };
  }

  getFormantStandardDeviation(formantNum = 1, samples = 10) {
    if (this.formantHistory.length < 2) return 0;

    const recent = this.formantHistory.slice(-samples);
    const formantKey = `F${formantNum}`;

    const values = recent.map(f => f[formantKey].frequency);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const squareDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;

    return Math.sqrt(avgSquareDiff);
  }

  getResonanceStability(samples = 10) {
    // Calculate overall resonance stability as percentage
    // Lower is better (more stable)
    const f1StdDev = this.getFormantStandardDeviation(1, samples);
    const f2StdDev = this.getFormantStandardDeviation(2, samples);

    const avgFormants = this.getAverageFormants(samples);
    if (!avgFormants) return 100; // Worst case

    // Calculate coefficient of variation (std dev / mean)
    const f1CV = avgFormants.F1 > 0 ? (f1StdDev / avgFormants.F1) * 100 : 100;
    const f2CV = avgFormants.F2 > 0 ? (f2StdDev / avgFormants.F2) * 100 : 100;

    // Return average CV as stability percentage
    return (f1CV + f2CV) / 2;
  }

  clearHistory() {
    this.formantHistory = [];
    this.resonanceRatioHistory = [];
  }

  // Calculate "brightness" metric (F2/F1 ratio)
  // Higher ratio = brighter/more feminine resonance
  getBrightnessRatio() {
    const avg = this.getAverageFormants();
    if (!avg || avg.F1 === 0) return null;
    return avg.F2 / avg.F1;
  }

  // ─── 共鸣比分析 ───

  /** Compute magnitude spectrum via FFT for spectral analysis */
  computeMagnitudeSpectrum(buffer) {
    const fftSize = 2048;
    // Use real FFT: for our purposes, simple DFT is sufficient
    const n = Math.min(fftSize, buffer.length);
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);
    
    // Copy and apply Hanning window
    for (let i = 0; i < n; i++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
      real[i] = buffer[i] * window;
    }
    
    // Compute magnitudes via DFT (simplified, keeps Nyquist bins)
    const magnitudes = new Float64Array(fftSize / 2);
    for (let k = 0; k < fftSize / 2; k++) {
      let sumReal = 0, sumImag = 0;
      for (let i = 0; i < n; i++) {
        const angle = -2 * Math.PI * k * i / fftSize;
        sumReal += real[i] * Math.cos(angle);
        sumImag += real[i] * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / fftSize;
    }
    return magnitudes;
  }

  /** Sum spectral energy in a frequency range [minHz, maxHz] */
  bandEnergy(magnitudes, minHz, maxHz) {
    const nyquist = this.sampleRate / 2;
    const minBin = Math.floor(minHz * magnitudes.length / nyquist);
    const maxBin = Math.ceil(maxHz * magnitudes.length / nyquist);
    let energy = 0;
    for (let i = minBin; i < maxBin && i < magnitudes.length; i++) {
      energy += magnitudes[i] * magnitudes[i];
    }
    return energy;
  }

  /**
   * 共鸣比例分析 — 计算头腔共鸣 vs 胸腔共鸣的能量比例
   * @param {Float32Array} buffer - 当前音频帧
   * @returns {Object|null} { ratio, chestPct, headPct, headDominant }
   *   ratio: 0~1, 越高头腔共鸣越主导
   *   chestPct: 胸腔共鸣能量百分比
   *   headPct: 头腔共鸣能量百分比
   *   headDominant: boolean, 是否头腔共鸣主导
   */
  getResonanceRatio(buffer) {
    if (!buffer || buffer.length < 256) return null;
    
    const magnitudes = this.computeMagnitudeSpectrum(buffer);
    
    // 胸腔共鸣频段: 80~1000Hz (F0 + F1区域)
    // 头腔共鸣频段: 1500~4000Hz (F2 + F3区域)
    // 过渡频段: 1000~1500Hz (混合区，两端各分一半)
    const chestEnergy = this.bandEnergy(magnitudes, 80, 1000);
    const headEnergy = this.bandEnergy(magnitudes, 1500, 4000);
    // 过渡区各算一半
    const transitionEnergy = this.bandEnergy(magnitudes, 1000, 1500);
    
    const totalEnergy = chestEnergy + headEnergy + transitionEnergy;
    if (totalEnergy < 1e-10) return null;
    
    // 按比例分配过渡区
    const adjustedChest = chestEnergy + transitionEnergy * (chestEnergy / (totalEnergy || 1));
    const adjustedHead = headEnergy + transitionEnergy * (headEnergy / (totalEnergy || 1));
    const adjustedTotal = adjustedChest + adjustedHead;
    
    const ratio = adjustedTotal > 0 ? adjustedHead / adjustedTotal : 0.5;
    
    // 存储历史
    if (!this.resonanceRatioHistory) this.resonanceRatioHistory = [];
    this.resonanceRatioHistory.push({
      ratio,
      chestPct: (1 - ratio) * 100,
      headPct: ratio * 100,
      timestamp: Date.now()
    });
    if (this.resonanceRatioHistory.length > 200) {
      this.resonanceRatioHistory.shift();
    }
    
    return {
      ratio,
      chestPct: (1 - ratio) * 100,
      headPct: ratio * 100,
      headDominant: ratio > 0.5
    };
  }

  /** 获取共鸣比历史趋势 */
  getResonanceRatioHistory(count = 30) {
    if (!this.resonanceRatioHistory || this.resonanceRatioHistory.length === 0) return [];
    return this.resonanceRatioHistory.slice(-count);
  }

  /** 获取平均共鸣比（最近N个采样） */
  getAverageResonanceRatio(samples = 10) {
    if (!this.resonanceRatioHistory || this.resonanceRatioHistory.length === 0) return null;
    const recent = this.resonanceRatioHistory.slice(-samples);
    const avg = recent.reduce((s, r) => s + r.ratio, 0) / recent.length;
    return {
      ratio: avg,
      chestPct: (1 - avg) * 100,
      headPct: avg * 100,
      headDominant: avg > 0.5
    };
  }
}

// Export for use in other modules
window.FormantAnalyzer = FormantAnalyzer;
