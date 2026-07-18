/**
 * LRC Player - 滚动歌词模块
 * 解析LRC格式歌词，实现K歌式滚动高亮显示
 */
class LRCPlayer {
  constructor() {
    this.lines = [];       // [{time, text}]
    this.currentIndex = -1;
    this.container = null;
    this.isActive = false;
    this.startTime = 0;
    this.songDuration = 240; // default 4 min
  }

  /**
   * 解析LRC格式字符串
   * @param {string} lrcText - "[00:13.16]歌词文字\n[00:15.87]下一句"
   * @returns {Array} [{time: seconds, text}]
   */
  parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
    let match;
    while ((match = regex.exec(lrcText)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      let ms = parseInt(match[3]);
      if (ms < 100) ms *= 10; // normalize to milliseconds
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) lines.push({ time, text });
    }
    return lines;
  }

  /**
   * 从LRCLIB API获取歌词
   * @param {string} artist - 歌手
   * @param {string} title - 歌名
   * @returns {Promise<string|null>} LRC格式歌词或null
   */
  async fetchLRC(artist, title) {
    try {
      const query = encodeURIComponent(`${artist} ${title}`);
      const resp = await fetch(`https://lrclib.net/api/search?q=${query}`);
      const data = await resp.json();
      if (data && data.length > 0 && data[0].syncedLyrics) {
        return data[0].syncedLyrics;
      }
      return null;
    } catch (e) {
      console.log('LRC fetch failed for', title, e.message);
      return null;
    }
  }

  /**
   * 加载歌词（优先LRC，回退到纯文本）
   * @param {string} lrcOrText - LRC格式或纯文本
   */
  load(lrcOrText) {
    if (!lrcOrText) {
      this.lines = [];
      return;
    }
    // 检测是否为LRC格式（含时间戳）
    if (/\[\d{2}:\d{2}\.\d{2,3}\]/.test(lrcOrText)) {
      this.lines = this.parseLRC(lrcOrText);
    } else {
      // 纯文本：按行拆分，均匀分配时间
      const textLines = lrcOrText.split('\n').filter(l => l.trim());
      if (textLines.length === 0) {
        this.lines = [];
        return;
      }
      const interval = this.songDuration / textLines.length;
      this.lines = textLines.map((text, i) => ({
        time: i * interval,
        text: text.trim()
      }));
    }
    this.currentIndex = -1;
  }

  /**
   * 开始滚动歌词显示
   * @param {HTMLElement} container - 歌词容器元素
   * @param {number} duration - 歌曲总时长（秒），用于纯文本模式
   */
  start(container, duration = 240) {
    this.container = container;
    this.songDuration = duration;
    this.isActive = true;
    this.startTime = Date.now();
    this.currentIndex = -1;
    this.render();
  }

  /**
   * 停止滚动
   */
  stop() {
    this.isActive = false;
  }

  /**
   * 渲染歌词到容器——只调用一次建立全部DOM，后续更新只改class
   */
  render() {
    if (!this.container) return;

    if (this.lines.length === 0) {
      this.container.innerHTML = '<div style="color:#a4b0be;text-align:center;padding:20px;">🎵 暂无歌词</div>';
      return;
    }

    // Build all lines once
    let html = '';
    for (let i = 0; i < this.lines.length; i++) {
      html += `<div class="lrc-line" data-lrc-idx="${i}" style="
        color:#666;font-size:14px;padding:2px 8px;border-radius:6px;
        line-height:2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">${this.lines[i].text}</div>`;
    }
    this.container.innerHTML = html;
    this._domLines = this.container.querySelectorAll('.lrc-line');
    this._applyHighlight();
  }

  /**
   * 切换高亮到当前行（仅改CSS类，不重建DOM）
   */
  _applyHighlight() {
    if (!this._domLines) return;
    for (let i = 0; i < this._domLines.length; i++) {
      const el = this._domLines[i];
      if (i === this.currentIndex) {
        el.style.color = '#ffd700';
        el.style.fontSize = '18px';
        el.style.fontWeight = 'bold';
        el.style.opacity = '1';
        el.style.background = 'rgba(255,215,0,0.15)';
        el.style.padding = '4px 8px';
      } else if (i < this.currentIndex) {
        el.style.color = '#ccc';
        el.style.fontSize = '14px';
        el.style.fontWeight = 'normal';
        el.style.opacity = '0.5';
        el.style.background = 'transparent';
        el.style.padding = '2px 8px';
      } else {
        el.style.color = '#666';
        el.style.fontSize = '14px';
        el.style.fontWeight = 'normal';
        el.style.opacity = '0.3';
        el.style.background = 'transparent';
        el.style.padding = '2px 8px';
      }
    }
  }

  /**
   * 每帧更新：根据已过时间高亮当前歌词行
   */
  update(elapsedMs) {
    if (!this.isActive || this.lines.length === 0) return;

    const elapsed = elapsedMs / 1000;
    let newIndex = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (elapsed >= this.lines[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex;
      this._applyHighlight();
      // Auto-scroll active line to center
      if (this._domLines && this._domLines[newIndex]) {
        this._domLines[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  async fetchPreviewUrl(artist, title) {
    try {
      const query = encodeURIComponent(`${artist} ${title}`);
      const resp = await fetch(`https://itunes.apple.com/search?term=${query}&country=cn&limit=3&media=music`);
      const data = await resp.json();
      if (data.results && data.results.length > 0) {
        for (const r of data.results) {
          if (r.previewUrl) return r.previewUrl;
        }
      }
      return null;
    } catch (e) { return null; }
  }
}

window.LRCPlayer = LRCPlayer;