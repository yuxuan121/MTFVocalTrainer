/**
 * Charts and visualization for progress tracking
 * Uses Canvas API for lightweight charting
 */
class Charts {
  constructor() {
    this.colors = {
      primary: '#e94560',
      secondary: '#0f3460',
      success: '#16c79a',
      background: '#1a1a2e',
      text: '#f1f1f1',
      grid: '#333'
    };
  }

  drawStreakCalendar(canvas, dailyPracticeMinutes, currentStreak) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate days to show (last 90 days)
    const today = new Date();
    const daysToShow = 90;
    const cellSize = Math.floor(width / 15);
    const cellPadding = 2;

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Draw title
    ctx.fillStyle = this.colors.text;
    ctx.fillText(`${currentStreak} day streak 🔥`, width / 2, 20);

    // Draw calendar grid (GitHub-style)
    let x = 10;
    let y = 40;
    let col = 0;

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const minutes = dailyPracticeMinutes[dateStr] || 0;

      // Color based on practice time
      if (minutes === 0) {
        ctx.fillStyle = this.colors.grid;
      } else if (minutes < 5) {
        ctx.fillStyle = '#0e4429';
      } else if (minutes < 15) {
        ctx.fillStyle = '#006d32';
      } else if (minutes < 30) {
        ctx.fillStyle = '#26a641';
      } else {
        ctx.fillStyle = '#39d353';
      }

      ctx.fillRect(x, y, cellSize - cellPadding, cellSize - cellPadding);

      col++;
      if (col >= 15) {
        col = 0;
        x = 10;
        y += cellSize;
      } else {
        x += cellSize;
      }
    }
  }

  drawLineChart(canvas, data, label, targetValue = null) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0) {
      ctx.fillStyle = this.colors.text;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', width / 2, height / 2);
      return;
    }

    // Find min/max for scaling
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw title
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, padding, 20);

    // Draw grid
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * (height - 2 * padding) / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - (i * valueRange / 5);
      ctx.fillStyle = this.colors.text;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(1), padding - 5, y + 3);
    }

    // Draw target line if provided
    if (targetValue !== null && targetValue >= minValue && targetValue <= maxValue) {
      const targetY = padding + ((maxValue - targetValue) / valueRange) * (height - 2 * padding);
      ctx.strokeStyle = this.colors.success;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, targetY);
      ctx.lineTo(width - padding, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw line
    ctx.strokeStyle = this.colors.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const xStep = (width - 2 * padding) / (data.length - 1 || 1);

    data.forEach((point, index) => {
      const x = padding + (index * xStep);
      const y = padding + ((maxValue - point.value) / valueRange) * (height - 2 * padding);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = this.colors.primary;
    data.forEach((point, index) => {
      const x = padding + (index * xStep);
      const y = padding + ((maxValue - point.value) / valueRange) * (height - 2 * padding);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  drawProgressBar(canvas, current, max, label) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const percentage = (current / max) * 100;

    // Draw label
    ctx.fillStyle = this.colors.text;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 10, 15);

    // Draw percentage
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(percentage)}%`, width - 10, 15);

    // Draw background bar
    const barY = 20;
    const barHeight = height - 30;
    ctx.fillStyle = this.colors.grid;
    ctx.fillRect(10, barY, width - 20, barHeight);

    // Draw progress bar
    const progressWidth = ((width - 20) * current) / max;
    const gradient = ctx.createLinearGradient(10, 0, 10 + progressWidth, 0);
    gradient.addColorStop(0, this.colors.secondary);
    gradient.addColorStop(1, this.colors.primary);
    ctx.fillStyle = gradient;
    ctx.fillRect(10, barY, progressWidth, barHeight);

    // Draw value text
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${current} / ${max}`, width / 2, barY + barHeight / 2 + 5);
  }

  drawPitchMeter(canvas, currentFreq, targetFreq, threshold = 10) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const meterWidth = width - 40;

    // Draw target zone
    ctx.fillStyle = 'rgba(22, 199, 154, 0.2)';
    ctx.fillRect(20 + meterWidth / 2 - 20, centerY - 30, 40, 60);

    // Draw scale
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, centerY);
    ctx.lineTo(width - 20, centerY);
    ctx.stroke();

    // Draw tick marks
    for (let i = -5; i <= 5; i++) {
      const x = 20 + meterWidth / 2 + (i * meterWidth / 12);
      ctx.beginPath();
      ctx.moveTo(x, centerY - 10);
      ctx.lineTo(x, centerY + 10);
      ctx.stroke();

      if (i !== 0) {
        ctx.fillStyle = this.colors.text;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((i * threshold / 2).toFixed(0), x, centerY + 25);
      }
    }

    // Draw current frequency indicator
    if (currentFreq) {
      const diff = currentFreq - targetFreq;
      const position = (diff / threshold) * (meterWidth / 6);
      const clampedPos = Math.max(-meterWidth / 2, Math.min(meterWidth / 2, position));

      const x = 20 + meterWidth / 2 + clampedPos;

      // Draw indicator
      ctx.fillStyle = Math.abs(diff) <= threshold / 4 ? this.colors.success : this.colors.primary;
      ctx.beginPath();
      ctx.arc(x, centerY, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw frequency text
      ctx.fillStyle = this.colors.text;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentFreq.toFixed(1)} Hz`, width / 2, height - 20);
    }

    // Draw target text
    ctx.fillStyle = this.colors.success;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Target: ${targetFreq.toFixed(1)} Hz`, width / 2, 20);
  }

  drawResonanceHeatmap(canvas, currentF1, currentF2, history) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = { left: 55, right: 15, top: 25, bottom: 35 };
    const pw = W - pad.left - pad.right;
    const ph = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Axes range: F1 200-1200 Hz, F2 500-3000 Hz
    const f1Min = 200, f1Max = 1200;
    const f2Min = 500, f2Max = 3000;

    const xFromF1 = (f1) => pad.left + ((f1 - f1Min) / (f1Max - f1Min)) * pw;
    const yFromF2 = (f2) => pad.top + ((f2Max - f2) / (f2Max - f2Min)) * ph;

    // Draw reference zones
    // Male zone: F1 400-600, F2 1000-1500
    ctx.fillStyle = 'rgba(233, 69, 96, 0.15)';
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
    ctx.lineWidth = 1;
    const maleRect = [xFromF1(400), yFromF2(1500), xFromF1(600) - xFromF1(400), yFromF2(1000) - yFromF2(1500)];
    ctx.fillRect(...maleRect);
    ctx.strokeRect(...maleRect);

    // Female zone: F1 600-900, F2 1500-2500
    ctx.fillStyle = 'rgba(22, 199, 154, 0.15)';
    ctx.strokeStyle = 'rgba(22, 199, 154, 0.5)';
    const femRect = [xFromF1(600), yFromF2(2500), xFromF1(900) - xFromF1(600), yFromF2(1500) - yFromF2(2500)];
    ctx.fillRect(...femRect);
    ctx.strokeRect(...femRect);

    // Draw history trail
    if (history && history.length > 1) {
      ctx.strokeStyle = 'rgba(0, 217, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const p = history[i];
        const x = xFromF1(p.f1);
        const y = yFromF2(p.f2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw history dots
      history.forEach((p, i) => {
        const alpha = 0.3 + (i / history.length) * 0.7;
        ctx.fillStyle = `rgba(0, 217, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(xFromF1(p.f1), yFromF2(p.f2), 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw current position
    if (currentF1 && currentF2) {
      const cx = xFromF1(currentF1);
      const cy = yFromF2(currentF2);

      // Glow
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 16);
      glow.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
      glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, 2 * Math.PI);
      ctx.fill();

      // Dot
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Current value label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`F1:${currentF1.toFixed(0)} F2:${currentF2.toFixed(0)}`, cx + 10, cy - 4);
    }

    // Axes labels and ticks
    ctx.fillStyle = '#a4b0be';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // X axis (F1)
    for (let f1 = 200; f1 <= 1200; f1 += 200) {
      const x = xFromF1(f1);
      ctx.fillText(f1 + 'Hz', x, H - pad.bottom + 15);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();
    }
    ctx.fillText('F1 (First Formant)', pad.left + pw / 2, H - 4);

    // Y axis (F2)
    ctx.textAlign = 'right';
    for (let f2 = 500; f2 <= 3000; f2 += 500) {
      const y = yFromF2(f2);
      ctx.fillText(f2 + 'Hz', pad.left - 6, y + 4);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(12, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('F2 (Second Formant)', 0, 0);
    ctx.restore();

    // Legend
    const lx = pad.left, ly = pad.top - 8;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(233, 69, 96, 0.9)';
    ctx.fillText('■ 男性共鸣区', lx, ly);
    ctx.fillStyle = 'rgba(22, 199, 154, 0.9)';
    ctx.fillText('■ 女性共鸣区', lx + 100, ly);
  }

  drawSongPitchTracker(canvas, currentPitch, rangeLow, rangeHigh, recentPitches) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { left: 45, right: 15, top: 25, bottom: 30 };
    const pw = W - pad.left - pad.right;
    const ph = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const yMin = Math.max(50, rangeLow - 50);
    const yMax = rangeHigh + 100;
    const yFromHz = (hz) => pad.top + ((yMax - hz) / (yMax - yMin)) * ph;

    // Target range band
    ctx.fillStyle = 'rgba(22, 199, 154, 0.12)';
    ctx.fillRect(pad.left, yFromHz(rangeHigh), pw, yFromHz(rangeLow) - yFromHz(rangeHigh));
    ctx.strokeStyle = 'rgba(22, 199, 154, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, yFromHz(rangeLow)); ctx.lineTo(W-pad.right, yFromHz(rangeLow)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, yFromHz(rangeHigh)); ctx.lineTo(W-pad.right, yFromHz(rangeHigh)); ctx.stroke();
    ctx.setLineDash([]);

    // Pitch history line
    if (recentPitches && recentPitches.length > 1) {
      ctx.strokeStyle = 'rgba(0, 217, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const step = pw / Math.max(1, recentPitches.length - 1);
      for (let i = 0; i < recentPitches.length; i++) {
        const x = pad.left + i * step;
        const y = yFromHz(recentPitches[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Current pitch dot
    if (currentPitch) {
      const cx = pad.left + pw - 15;
      const cy = yFromHz(currentPitch);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`${currentPitch.toFixed(0)} Hz`, cx - 12, cy - 8);
    }

    // Labels
    ctx.fillStyle = '#a4b0be'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${rangeHigh}Hz`, pad.left + 4, yFromHz(rangeHigh) - 4);
    ctx.fillText(`${rangeLow}Hz`, pad.left + 4, yFromHz(rangeLow) + 12);
    ctx.fillText('目标音高区间', pad.left + pw/2 - 30, pad.top - 6);
  }

  /**
   * 嗓音女性化进度图 —— 从男声到女声的成长轨迹
   */
  drawFeminizationJourney(canvas, currentAvgHz, dailyAverages, targetHz) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { left: 50, right: 20, top: 40, bottom: 50 };
    const pw = W - pad.left - pad.right;
    const ph = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Y-axis: 80-300Hz range
    const yMin = 80, yMax = 300;
    const yFromHz = (hz) => pad.top + ((yMax - hz) / (yMax - yMin)) * ph;

    // Draw zone bands
    // Male zone: 85-155Hz (red)
    ctx.fillStyle = 'rgba(233, 69, 96, 0.12)';
    ctx.fillRect(pad.left, yFromHz(155), pw, yFromHz(85) - yFromHz(155));

    // Neutral zone: 155-185Hz (yellow)
    ctx.fillStyle = 'rgba(255, 165, 2, 0.12)';
    ctx.fillRect(pad.left, yFromHz(185), pw, yFromHz(155) - yFromHz(185));

    // Female zone: 185-255Hz (green)
    ctx.fillStyle = 'rgba(22, 199, 154, 0.12)';
    ctx.fillRect(pad.left, yFromHz(255), pw, yFromHz(185) - yFromHz(255));

    // Zone labels
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(233, 69, 96, 0.7)';
    ctx.fillText('男声区 85-155Hz', pad.left - 4, yFromHz(120));
    ctx.fillStyle = 'rgba(255, 165, 2, 0.7)';
    ctx.fillText('中性区 155-185Hz', pad.left - 4, yFromHz(168));
    ctx.fillStyle = 'rgba(22, 199, 154, 0.7)';
    ctx.fillText('女声区 185-255Hz', pad.left - 4, yFromHz(215));

    // Target line
    if (targetHz) {
      const ty = yFromHz(targetHz);
      ctx.strokeStyle = 'rgba(22, 199, 154, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath(); ctx.moveTo(pad.left, ty); ctx.lineTo(W - pad.right, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#16c79a';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`目标 ${targetHz}Hz`, pad.left + 4, ty - 4);
    }

    // Y-axis ticks
    ctx.fillStyle = '#a4b0be'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    for (let hz = 100; hz <= 300; hz += 20) {
      const y = yFromHz(hz);
      ctx.fillText(hz, W - pad.right + 6, y + 3);
      ctx.strokeStyle = '#2a2a3e'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // Plot daily averages as a line
    if (dailyAverages && dailyAverages.length > 0) {
      const data = dailyAverages.filter(d => d.hz > 0);
      if (data.length > 1) {
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const step = pw / Math.max(1, data.length - 1);
        data.forEach((d, i) => {
          const x = pad.left + i * step;
          const y = yFromHz(d.hz);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots for each day
        data.forEach((d, i) => {
          const x = pad.left + i * step;
          const y = yFromHz(d.hz);
          ctx.fillStyle = '#00d9ff';
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 2*Math.PI); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        });
      }
    }

    // Current position marker (big, golden)
    if (currentAvgHz && currentAvgHz > 0) {
      const cx = W - pad.right - 20;
      const cy = yFromHz(Math.min(yMax, Math.max(yMin, currentAvgHz)));
      
      // Glow
      const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, 18);
      glow.addColorStop(0, 'rgba(255,215,0,0.8)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 2*Math.PI); ctx.fill();

      // Star marker
      ctx.fillStyle = '#ffd700';
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⭐', cx, cy + 6);

      // Label
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${currentAvgHz.toFixed(0)} Hz`, cx, cy - 16);
    }

    // Title
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🎯 嗓音女性化进程', pad.left + pw/2, 16);

    // X-axis label
    if (dailyAverages && dailyAverages.length > 1) {
      ctx.fillStyle = '#a4b0be'; ctx.font = '9px sans-serif';
      ctx.fillText('← 早期', pad.left, H - 6);
      ctx.fillText('最近 →', W - pad.right - 30, H - 6);
    }
  }

  /**
   * 女性化指数圆环 —— 直观的百分比指标
   */
  drawFeminizationGauge(canvas, percentage, label) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2 + 5;
    const radius = Math.min(cx, cy) - 15;

    ctx.clearRect(0, 0, W, H);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI * 0.8, Math.PI * 2.2);
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Progress arc
    const pct = Math.min(100, Math.max(0, percentage));
    const startAngle = Math.PI * 0.8;
    const endAngle = startAngle + (pct / 100) * Math.PI * 1.4;
    
    const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    gradient.addColorStop(0, '#e94560');
    gradient.addColorStop(0.5, '#ffa502');
    gradient.addColorStop(1, '#16c79a');
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Percentage text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(pct)}%`, cx, cy - 4);

    // Label
    ctx.fillStyle = '#a4b0be';
    ctx.font = '11px sans-serif';
    ctx.fillText(label || '女性化进度', cx, cy + 22);

    // Stage label
    let stage, stageColor;
    if (pct < 30) { stage = '男声区'; stageColor = '#e94560'; }
    else if (pct < 55) { stage = '过渡中'; stageColor = '#ffa502'; }
    else if (pct < 80) { stage = '接近女声'; stageColor = '#00d9ff'; }
    else { stage = '女声达成！'; stageColor = '#16c79a'; }
    
    ctx.fillStyle = stageColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(stage, cx, cy + 40);
  }
}

// Export for use in other modules
window.Charts = Charts;
