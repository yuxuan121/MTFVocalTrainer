/**
 * DoubaoAPI - 豆包API封装层
 * 
 * 支持两种模式：
 *   1. 云函数代理（推荐）：端侧发HTTP POST到代理URL，代理转发豆包API
 *   2. 直连（调试用）：直接调用豆包开放平台接口
 * 
 * 离线降级：API不可用时，从本地话术模板库返回反馈
 */
class DoubaoAPI {
  constructor() {
    // 云函数代理地址（用户可配置）
    this._proxyURL = localStorage.getItem('doubao_proxy_url') || '';
    // API Key：优先从配置文件读取，其次 localStorage
    this._apiKey = (window.__DOUBAO_CONFIG__ && window.__DOUBAO_CONFIG__.apiKey) ||
                   localStorage.getItem('doubao_api_key') || '';

    // API状态
    this._online = true;
    this._failCount = 0;
    this._maxFails = 3;          // 连续失败N次自动降级
    this._dailyCallCount = 0;
    this._dailyLimit = 100;      // 每日上限

    // 重试配置
    this._retryMax = 2;
    this._timeout = 10000;       // 10s超时

    // 会话管理
    this._sessionId = null;
    this._coachProfile = null;
    this._profileReady = false;

    // 加载当日调用计数
    this._loadDailyCount();

    // 异步加载教练配置文件
    this._loadCoachProfile();
  }

  // ===== 公开方法 =====

  /**
   * 设置云函数代理地址
   */
  setProxyURL(url) {
    this._proxyURL = url;
    if (url) {
      localStorage.setItem('doubao_proxy_url', url);
    } else {
      localStorage.removeItem('doubao_proxy_url');
    }
  }

  /**
   * 设置豆包API Key（直连模式用）
   */
  setAPIKey(key) {
    this._apiKey = key;
    if (key) {
      localStorage.setItem('doubao_api_key', key);
      this._online = true;
      this._failCount = 0;
    } else {
      localStorage.removeItem('doubao_api_key');
      this._apiKey = null;
    }
  }

  /**
   * 检查API是否可用
   */
  isOnline() {
    return this._online && this._dailyCallCount < this._dailyLimit;
  }

  /**
   * 获取是否已配置API Key
   */
  hasAPIKey() {
    return !!(this._apiKey || localStorage.getItem('doubao_api_key'));
  }

  async _loadCoachProfile() {
    try {
      var resp = await fetch('coach_profile.json');
      if (resp.ok) {
        this._coachProfile = await resp.json();
        this._profileReady = true;
        console.log('Coach profile v' + this._coachProfile.version + ' loaded');
      }
    } catch(e) {
      console.warn('Coach profile load failed, using defaults');
    }
  }

  _getPersona() {
    if (this._coachProfile && this._coachProfile.persona) return this._coachProfile.persona;
    return '你是温柔耐心的嗓音训练教练。用朋友式语气聊天，回复简洁，关注发声状态。';
  }

  _getStagePrompt(stage) {
    if (this._coachProfile && this._coachProfile.stages && this._coachProfile.stages[stage]) {
      return this._coachProfile.stages[stage].prompt;
    }
    return '';
  }

  _getChatRules() {
    if (this._coachProfile && this._coachProfile.chat_rules) return this._coachProfile.chat_rules;
    return { max_reply_length: 300, temperature: 0.8, model: 'doubao-lite-128k', max_history_rounds: 10 };
  }

  /**
   * 开始新会话
   */
  startSession() {
    this._sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    return this._sessionId;
  }

  /**
   * 纯聊天：发送用户消息，返回AI回复（不传训练策略数据）
   * @param {string} userMessage - 用户输入的文字
   * @param {Array} history - 最近N轮对话历史 [{role:'user'|'assistant',content}]
   * @returns {Promise<Object>} { text, success, offline }
   */
  async chat(userMessage, history) {
    if (this._dailyCallCount >= this._dailyLimit) {
      return { text: '今天对话次数已用完，明天再来聊吧~', success: false, offline: true };
    }

    const apiKey = this._apiKey || localStorage.getItem('doubao_api_key') || '';
    const useProxy = !!this._proxyURL;

    try {
      let url, body, headers;

      if (useProxy) {
        url = this._proxyURL;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
          session_id: this._sessionId,
          type: 'chat',
          user_message: userMessage,
          history: (history || []).slice(-10),
          timestamp: Date.now()
        });
      } else {
        url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        };
        body = JSON.stringify(this._buildChatRequest(userMessage, history));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this._timeout);

      const resp = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new Error('Auth failed - 请检查API Key');
        }
        throw new Error('HTTP ' + resp.status);
      }

      const data = await resp.json();
      let text;

      if (useProxy) {
        text = data.text || data.reply || '';
      } else {
        text = (data.choices && data.choices[0] && data.choices[0].message)
          ? data.choices[0].message.content : '';
      }

      if (!text) throw new Error('Empty response');

      this._failCount = 0;
      this._online = true;
      this._dailyCallCount++;
      this._saveDailyCount();
      return { text: text, success: true, offline: false };
    } catch (err) {
      console.warn('DoubaoAPI chat failed:', err.message);
      this._failCount++;
      if (this._failCount >= this._maxFails) {
        this._online = false;
      }
      return { text: this._getOfflineChatReply(userMessage), success: false, offline: true };
    }
  }

  /** 构建纯聊天请求的 messages */
  _buildChatRequest(userMessage, history) {
    var systemPrompt = this._getPersona();
    var rules = this._getChatRules();

    var messages = [{ role: 'system', content: systemPrompt }];
    if (history && history.length) {
      messages.push.apply(messages, history.slice(-(rules.max_history_rounds || 10)));
    }
    messages.push({ role: 'user', content: userMessage });

    return {
      model: rules.model || 'doubao-lite-128k',
      messages: messages,
      max_tokens: rules.max_reply_length || 300,
      temperature: rules.temperature || 0.8
    };
  }

  /** 离线聊天话术 */
  _getOfflineChatReply(userMessage) {
    const replies = [
      '嗯嗯，我听到了～不过现在网络不太好，等网络恢复了再好好聊吧',
      '你的声音很好听呢，继续保持练习哦～',
      '虽然现在离线了，但我还在陪着你呢',
      '这个话题很有趣！等联网了我再跟你详细聊',
      '放轻松，随便聊聊就好，不用有压力'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  /**
   * 核心：发送一轮训练策略请求
   * @param {Object} strategyResult - CoachStrategy.evaluate() 的输出
   * @param {string} userText - 用户说的话（ASR后文本，离线时可选）
   * @returns {Promise<Object>} { text, audioURL, success }
   */
  async sendChatTurn(strategyResult, userText) {
    // 检查限流
    if (this._dailyCallCount >= this._dailyLimit) {
      return this._offlineFallback(strategyResult);
    }

    try {
      const response = await this._callAPI(strategyResult, userText);
      this._failCount = 0;
      this._online = true;
      this._dailyCallCount++;
      this._saveDailyCount();
      return { ...response, success: true };
    } catch (err) {
      console.warn('DoubaoAPI call failed:', err.message);
      this._failCount++;
      if (this._failCount >= this._maxFails) {
        this._online = false;
        console.warn('DoubaoAPI: switched to offline mode after', this._maxFails, 'failures');
      }
      return this._offlineFallback(strategyResult);
    }
  }

  /**
   * 获取当日调用统计
   */
  getStats() {
    return {
      online: this._online,
      failCount: this._failCount,
      dailyCalls: this._dailyCallCount,
      dailyLimit: this._dailyLimit,
      sessionId: this._sessionId
    };
  }

  // ===== 内部方法 =====

  async _callAPI(strategyResult, userText) {
    const { action, params } = strategyResult;
    const useProxy = !!this._proxyURL;
    const apiKey = this._apiKey || localStorage.getItem('doubao_api_key') || '';

    let url, body, headers;

    if (useProxy) {
      // 代理模式：自定义格式，代理负责转码
      url = this._proxyURL;
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({
        session_id: this._sessionId,
        action: action,
        params: params,
        user_text: userText || '',
        timestamp: Date.now()
      });
    } else {
      // 直连模式：标准 Chat Completions 格式
      url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
      body = JSON.stringify(this._buildChatMessages(action, params, userText));
    }

    // 发送请求（带重试）
    let lastError;
    for (let attempt = 0; attempt <= this._retryMax; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this._timeout);

        const resp = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: body,
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!resp.ok) {
          if (resp.status === 429) {
            throw new Error('Rate limited (429)');
          }
          if (resp.status === 401 || resp.status === 403) {
            throw new Error('Auth failed (' + resp.status + ') - 请检查API Key');
          }
          throw new Error('HTTP ' + resp.status);
        }

        const data = await resp.json();

        if (useProxy) {
          // 代理格式
          if (data.text) {
            return { text: data.text, audioURL: data.audio_url || null, ttsText: data.tts_text || data.text };
          }
        } else {
          // 豆包直连 Chat Completions 格式
          if (data.choices && data.choices[0] && data.choices[0].message) {
            return { text: data.choices[0].message.content, audioURL: null, ttsText: data.choices[0].message.content };
          }
        }

        throw new Error('Unexpected response format: ' + JSON.stringify(data).slice(0, 200));
      } catch (err) {
        lastError = err;
        if (attempt < this._retryMax) {
          await this._sleep(1000 * (attempt + 1)); // 递增等待
        }
      }
    }
    throw lastError;
  }

  /**
   * 将策略结果转成标准 Chat Completions messages 格式
   */
  _buildChatMessages(action, params, userText) {
    const stageMap = { beginner: '入门', intermediate: '进阶', advanced: '高阶' };
    const stageName = stageMap[params.stage] || '入门';
    const actionMap = {
      praise_stable: '用户音调稳定在目标区间内，需要鼓励',
      hint_raise: '用户音调偏低，需要引导升高音调',
      hint_lower: '用户音调偏高，需要引导降低音调',
      ready_upgrade: '用户连续多次稳定达标，准备升级',
      need_rest: '用户连续偏离，需要建议休息',
      no_voice: '用户没有说话',
      idle: '用户正常说话，不需要特别指导'
    };

    var persona = this._getPersona();
    var stagePrompt = this._getStagePrompt(params.stage || 'beginner');
    var systemPrompt = persona + '\n' +
      '当前训练阶段提示：' + (stagePrompt || '按默认策略引导');

    const userMsg = '【训练数据】\n' +
      '当前音高：' + params.freq + ' Hz\n' +
      '目标区间：' + params.targetMin + '-' + params.targetMax + ' Hz\n' +
      '当前阶段：' + stageName + ' 第' + params.subLevel + '阶\n' +
      '连续稳频：' + params.streak + '次\n' +
      '训练状态：' + (actionMap[action] || '正常') + '\n' +
      (userText ? '用户说的话：' + userText + '\n' : '') +
      '\n请给我一句简短自然的反馈。';

    return {
      model: 'doubao-lite-128k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      max_tokens: 150,
      temperature: 0.7
    };
  }

  /**
   * 离线降级：用本地话术模板
   */
  _offlineFallback(strategyResult) {
    const { action, params } = strategyResult;
    const text = this._getOfflinePrompt(action, params);
    return {
      text: text,
      audioURL: null,
      ttsText: text,
      success: false,
      offline: true
    };
  }

  /**
   * 本地话术模板库
   */
  _getOfflinePrompt(action, params) {
    const { freq, deviation, targetMin, targetMax } = params;
    const prompts = {
      'praise_stable': [
        '音调稳定，继续保持！',
        '这次很稳，非常好～',
        '完美，就保持这种感觉',
        '很棒！你已经越来越稳了',
        '这个音高很适合你，继续加油'
      ],
      'hint_raise': [
        '试着把声音再抬高一点',
        '尾音往上扬一扬会更好',
        '稍微再高一点点就完美了',
        '有进步，再往上提一提'
      ],
      'hint_lower': [
        '放松一点，声音稍微有点高了',
        '放轻松，不用那么用力',
        '稍微降一点会更自然',
        '自然一点就好，不用刻意拔高'
      ],
      'ready_upgrade': [
        '达标了！准备进入下一阶段！',
        '太厉害了，连续稳定！升级！',
        '你已经准备好了，挑战更高目标吧'
      ],
      'need_rest': [
        '休息一下吧，你已经很棒了',
        '今天辛苦了，明天继续加油',
        '放松一下，别太勉强自己'
      ],
      'no_voice': [
        '我在听呢，试试说点什么？',
        '随便聊聊天吧，不用紧张',
        '说说今天过得怎么样？'
      ],
      'idle': [
        '继续聊，我听着呢～',
        '嗯嗯，然后呢？',
        '说得很自然，继续保持'
      ]
    };

    const list = prompts[action] || prompts['idle'];
    return list[Math.floor(Math.random() * list.length)];
  }

  _loadDailyCount() {
    try {
      const stored = localStorage.getItem('doubao_daily');
      if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        if (data.date === today) {
          this._dailyCallCount = data.count || 0;
        } else {
          this._dailyCallCount = 0;
        }
      }
    } catch (e) {
      this._dailyCallCount = 0;
    }
  }

  _saveDailyCount() {
    localStorage.setItem('doubao_daily', JSON.stringify({
      date: new Date().toDateString(),
      count: this._dailyCallCount
    }));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.DoubaoAPI = DoubaoAPI;