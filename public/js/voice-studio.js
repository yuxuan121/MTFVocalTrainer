/**
 * Voice Studio - 嗓音工作室
 * 录制 → 导出 → 转换 → 导入 → 替换教练声音
 */
class VoiceStudio {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.currentSentenceIdx = 0;
    this.recordings = {}; // { sentenceId: Blob }
    
    // 15 sentences mapped to dialog index
    this.sentences = this._buildSentenceList();
    
    // Voice style presets (for RVC conversion guidance)
    this.styles = {
      'yujie':    { name: '温柔御姐', icon: '💼', desc: '成熟优雅，适合日常对话',  model: '成熟女声模型' },
      'luoli':    { name: '元气少女', icon: '🌸', desc: '活泼可爱，适合轻松聊天',  model: '少女声模型' },
      'wenrou':   { name: '知性温柔', icon: '🌙', desc: '轻声细语，适合温柔场景',  model: '温柔女声模型' },
      'huopo':    { name: '活泼俏皮', icon: '⭐', desc: '撒娇感十足，尾音上扬',    model: '活泼女声模型' },
      'xiaoxiao': { name: '微软晓晓', icon: '🤖', desc: 'Edge TTS 默认女声',      model: '无需转换' }
    };
  }

  _buildSentenceList() {
    // All 15 sentences from D1-D3 conversations
    return [
      { id: 'd1_01', level: 'D1', text: '今天天气真不错呢',     reply: '是呀，阳光很好' },
      { id: 'd1_02', level: 'D1', text: '你好，很高兴认识你',     reply: '我也是，请多关照' },
      { id: 'd1_03', level: 'D1', text: '这道菜做得真好吃',       reply: '谢谢，你喜欢就好' },
      { id: 'd1_04', level: 'D1', text: '我们一起去散步吧',       reply: '好呀，去哪里呢' },
      { id: 'd1_05', level: 'D1', text: '这个颜色很适合你',       reply: '真的吗？谢谢你' },
      { id: 'd2_01', level: 'D2', text: '你好，我想点一杯拿铁，少糖', reply: '好的请稍等' },
      { id: 'd2_02', level: 'D2', text: '哎呀你怎么才来呀',       reply: '对不起路上堵车了' },
      { id: 'd2_03', level: 'D2', text: '周末你有什么计划吗',     reply: '想去看看花展' },
      { id: 'd2_04', level: 'D2', text: '这件衣服你觉得怎么样',   reply: '挺好看的，很显气质' },
      { id: 'd2_05', level: 'D2', text: '明天一起吃午饭吧',       reply: '好啊，十二点见' },
      { id: 'd3_01', level: 'D3', text: '我跟你说哦，昨天看到一只超可爱的小猫', reply: '真的吗？什么颜色的？' },
      { id: 'd3_02', level: 'D3', text: '好久不见！你最近瘦了好多呀', reply: '哪有，可能是最近太忙了' },
      { id: 'd3_03', level: 'D3', text: '你听说了吗？他们下周要结婚了', reply: '真的假的？太好了！' },
      { id: 'd3_04', level: 'D3', text: '今天加班加到快累死了……',   reply: '辛苦了，好好休息一下' },
      { id: 'd3_05', level: 'D3', text: '谢谢你一直陪在我身边',   reply: '不用谢，应该的' }
    ];
  }

  /**
   * Start recording for a specific sentence
   */
  async startRecording(sentenceId) {
    if (this.isRecording) return false;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      this.audioChunks = [];
      this.currentSentenceIdx = this.sentences.findIndex(s => s.id === sentenceId);
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordings[sentenceId] = blob;
        stream.getTracks().forEach(t => t.stop());
      };
      
      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (e) {
      console.error('Recording failed:', e);
      return false;
    }
  }

  /**
   * Stop current recording
   */
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const sid = this.sentences[this.currentSentenceIdx]?.id;
        if (sid) this.recordings[sid] = blob;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  /**
   * Get recording blob for a sentence
   */
  getRecording(sentenceId) {
    return this.recordings[sentenceId] || null;
  }

  hasRecording(sentenceId) {
    return !!this.recordings[sentenceId];
  }

  /**
   * Get all recording URLs for playback
   */
  getAllRecordingURLs() {
    const urls = {};
    for (const [id, blob] of Object.entries(this.recordings)) {
      urls[id] = URL.createObjectURL(blob);
    }
    return urls;
  }

  /**
   * Get count of completed recordings
   */
  getProgress() {
    const total = this.sentences.length;
    const done = Object.keys(this.recordings).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  /**
   * Export all recordings as downloadable files (one by one)
   * Returns array of { id, text, blob, url }
   */
  exportRecordings() {
    const exports = [];
    for (const s of this.sentences) {
      if (this.recordings[s.id]) {
        const url = URL.createObjectURL(this.recordings[s.id]);
        exports.push({ id: s.id, text: s.text, blob: this.recordings[s.id], url });
      }
    }
    return exports;
  }

  /**
   * Import a converted audio file for a sentence
   * @param {string} sentenceId 
   * @param {File|Blob} audioFile - mp3/wav
   */
  importAudio(sentenceId, audioFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Store as base64 or just keep reference
        this.recordings[sentenceId + '_converted'] = audioFile;
        resolve(audioFile);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioFile);
    });
  }

  /**
   * Play a converted audio file
   */
  playConverted(sentenceId) {
    return new Promise((resolve, reject) => {
      const blob = this.recordings[sentenceId + '_converted'];
      if (!blob) { reject(new Error('No converted audio')); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Playback failed')); };
      audio.play().catch(reject);
    });
  }

  /**
   * Save converted audio references to localStorage
   */
  saveConvertedReferences() {
    const refs = {};
    for (const s of this.sentences) {
      if (this.recordings[s.id + '_converted']) {
        refs[s.id] = true;
      }
    }
    localStorage.setItem('voiceStudio_converted', JSON.stringify(refs));
    return Object.keys(refs).length;
  }

  getConvertedReferences() {
    try {
      return JSON.parse(localStorage.getItem('voiceStudio_converted') || '{}');
    } catch { return {}; }
  }
}

window.VoiceStudio = VoiceStudio;