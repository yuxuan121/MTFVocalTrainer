/**
 * Conversation Coach - AI对话教练模块
 * AI用女声朗读 → 用户跟读 → 实时音高对比反馈
 */
class ConversationCoach {
  constructor() {
    this.currentLevel = 1;
    this.currentIndex = 0;
    this.isActive = false;
    this.sessionData = [];
    this.sessionStartTime = null;

    this.defineDialogs();
  }

  defineDialogs() {
    this.levels = {
      1: {
        name: 'D1 入门', range: [150, 170], color: '#4a90d9',
        desc: '短句慢速，建立音高基础',
        dialogs: [
          { text: '今天天气真不错呢', reply: '是呀，阳光很好', hint: '用说话的感觉，不要用力' },
          { text: '你好，很高兴认识你', reply: '我也是，请多关照', hint: '尾音轻轻上扬' },
          { text: '这道菜做得真好吃', reply: '谢谢，你喜欢就好', hint: '像聊天一样自然' },
          { text: '我们一起去散步吧', reply: '好呀，去哪里呢', hint: '保持匀速，不要急' },
          { text: '这个颜色很适合你', reply: '真的吗？谢谢你', hint: '最后一个字稍延长' }
        ]
      },
      2: {
        name: 'D2 进阶', range: [170, 200], color: '#00d4aa',
        desc: '日常对话，加入情绪起伏',
        dialogs: [
          { text: '你好，我想点一杯拿铁，少糖', reply: '好的请稍等', hint: '自然句间停顿' },
          { text: '哎呀你怎么才来呀', reply: '对不起路上堵车了', hint: '带一点撒娇语气' },
          { text: '周末你有什么计划吗', reply: '想去看看花展', hint: '句末上扬表示期待' },
          { text: '这件衣服你觉得怎么样', reply: '挺好看的，很显气质', hint: '保持音高不下掉' },
          { text: '明天一起吃午饭吧', reply: '好啊，十二点见', hint: '轻松愉快的感觉' }
        ]
      },
      3: {
        name: 'D3 高阶', range: [200, 240], color: '#e94560',
        desc: '长句带情绪，接近自然女声',
        dialogs: [
          { text: '我跟你说哦，昨天看到一只超可爱的小猫', reply: '真的吗？什么颜色的？', hint: '兴奋感，音高上扬' },
          { text: '好久不见！你最近瘦了好多呀', reply: '哪有，可能是最近太忙了', hint: '先惊喜后谦虚' },
          { text: '你听说了吗？他们下周要结婚了', reply: '真的假的？太好了！', hint: '分享好消息的感觉' },
          { text: '今天加班加到快累死了……', reply: '辛苦了，好好休息一下', hint: '带点撒娇的抱怨' },
          { text: '谢谢你一直陪在我身边', reply: '不用谢，应该的', hint: '温柔真诚的语气' }
        ]
      }
    };
  }

  getLevelInfo(level) {
    return this.levels[level] || this.levels[1];
  }

  getCurrentDialog() {
    const lv = this.levels[this.currentLevel];
    if (!lv) return null;
    return lv.dialogs[this.currentIndex] || lv.dialogs[0];
  }

  nextDialog() {
    const lv = this.levels[this.currentLevel];
    if (!lv) return;
    this.currentIndex++;
    if (this.currentIndex >= lv.dialogs.length) {
      this.currentIndex = 0;
      // Auto-advance level if completed all
      if (this.currentLevel < 3) this.currentLevel++;
    }
    return this.getCurrentDialog();
  }

  prevDialog() {
    if (this.currentIndex > 0) this.currentIndex--;
    else {
      if (this.currentLevel > 1) {
        this.currentLevel--;
        this.currentIndex = this.levels[this.currentLevel].dialogs.length - 1;
      }
    }
    return this.getCurrentDialog();
  }

  startSession(level) {
    this.currentLevel = level || 1;
    this.currentIndex = 0;
    this.isActive = true;
    this.sessionData = [];
    this.sessionStartTime = Date.now();
    return this.getCurrentDialog();
  }

  /**
   * Speak using Edge TTS (Xiaoxiao Neural) → local mp3 → Web Speech fallback
   * @param {string} text - Text to speak
   * @returns {Promise<void>}
   */
  async speak(text) {
    // Priority 1: Try local pre-recorded audio file
    const dialog = this.getCurrentDialog();
    if (dialog && dialog.audioFile) {
      try {
        await this._playAudio('/audio/' + dialog.audioFile);
        return;
      } catch(e) { /* fall through */ }
    }

    // Priority 2: Edge TTS (free, no API key, natural female voice)
    try {
      await this._speakEdgeTTS(text);
      return;
    } catch(e) {
      console.warn('Edge TTS failed, falling back to Web Speech:', e);
    }

    // Priority 3: Web Speech API (built-in, works everywhere)
    await this._speakWebSpeech(text);
  }

  /**
   * Edge TTS - Microsoft's free neural voice (Xiaoxiao)
   * Uses WebSocket to stream MP3 audio directly from Microsoft servers
   */
  _speakEdgeTTS(text) {
    return new Promise((resolve, reject) => {
      const voiceName = this._edgeVoice || 'zh-CN-XiaoxiaoNeural';
      const rate = this._edgeRate || 0.9;
      const pitch = this._edgePitch || '+0Hz';
      
      const reqId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
      const connId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connId}`;
      
      let ws;
      try {
        ws = new WebSocket(url);
      } catch(e) {
        reject(e);
        return;
      }

      ws.binaryType = 'arraybuffer';
      const audioChunks = [];
      let timer;

      ws.onopen = () => {
        const ssml = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
          `<voice name='${voiceName}'><prosody rate='${rate}' pitch='${pitch}'>${text}</prosody></voice></speak>`;
        ws.send(ssml);
        
        // Timeout: if no response in 10s, abort
        timer = setTimeout(() => {
          ws.close();
          reject(new Error('Edge TTS timeout'));
        }, 10000);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
          // First few bytes might be headers; check for "Path:audio" prefix
          const data = new Uint8Array(event.data);
          const headerEnd = this._findHeaderEnd(data);
          if (headerEnd < data.length) {
            audioChunks.push(data.slice(headerEnd));
          }
        } else if (typeof event.data === 'string' && event.data.includes('Path:turn.end')) {
          // End of stream signal
          ws.close();
        }
      };

      ws.onclose = () => {
        clearTimeout(timer);
        if (audioChunks.length === 0) {
          reject(new Error('No audio data received'));
          return;
        }
        const blob = new Blob(audioChunks, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Audio playback failed')); };
        audio.play().catch(reject);
      };

      ws.onerror = () => {
        clearTimeout(timer);
        ws.close();
        reject(new Error('WebSocket error'));
      };
    });
  }

  /** Find where binary audio data starts after SSML headers */
  _findHeaderEnd(data) {
    // Headers end with \r\n\r\n or after "Path:audio\r\n"
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 13 && data[i+1] === 10 && data[i+2] === 13 && data[i+3] === 10) {
        return i + 4;
      }
    }
    return 0; // No header found, use all data
  }

  /** Play local audio file */
  _playAudio(filePath) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(filePath);
      audio.onended = resolve;
      audio.onerror = () => reject(new Error('Audio file not found: ' + filePath));
      audio.play().catch(reject);
    });
  }

  /** Web Speech API fallback */
  _speakWebSpeech(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        console.warn('Speech synthesis not supported');
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1.5;
      utterance.volume = 0.8;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Configure Edge TTS voice settings
   * @param {object} opts - { voice, rate, pitch }
   *  voice options: 'zh-CN-XiaoxiaoNeural'(元气少女), 'zh-CN-XiaoyiNeural'(温柔御姐),
   *                 'zh-CN-YunxiNeural'(沉稳男播), 'zh-CN-YunjianNeural'(成熟男声)
   */
  setVoiceConfig(opts) {
    if (opts.voice) this._edgeVoice = opts.voice;
    if (opts.rate) this._edgeRate = opts.rate;
    if (opts.pitch) this._edgePitch = opts.pitch;
  }

  feedPitch(pitch) {
    if (!this.isActive || !pitch) return { inRange: false, rangePct: 0, status: 'no_signal' };
    
    const range = this.getLevelInfo(this.currentLevel).range;
    const [low, high] = range;
    const inRange = pitch >= low && pitch <= high;
    const center = (low + high) / 2;
    const maxDev = (high - low) / 2;
    const deviation = Math.abs(pitch - center);
    const rangePct = Math.round(Math.max(0, Math.min(100, 100 - (deviation / maxDev) * 100)));

    let status = 'no_signal';
    if (inRange) {
      status = rangePct > 80 ? 'excellent' : 'good';
    } else {
      status = pitch < low ? 'too_low' : 'too_high';
    }

    this.sessionData.push({ time: Date.now() - this.sessionStartTime, pitch, inRange });
    return { inRange, rangePct, status };
  }

  stopSession() {
    this.isActive = false;
    return this.calculateScore();
  }

  calculateScore() {
    if (this.sessionData.length === 0) return { score: 0, accuracy: 0 };
    const inRange = this.sessionData.filter(d => d.inRange).length;
    const accuracy = Math.round((inRange / this.sessionData.length) * 100);
    const score = accuracy;
    return { score, accuracy };
  }
}

window.ConversationCoach = ConversationCoach;