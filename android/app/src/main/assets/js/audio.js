/**
 * Web Audio API setup and management
 */
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.javascriptNode = null;
    this.stream = null;
    this.isRecording = false;
    this.bufferSize = 2048;
  }

  async initialize() {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);

      // Create script processor for real-time analysis
      this.javascriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

      // Connect nodes
      this.microphone.connect(this.analyser);
      this.analyser.connect(this.javascriptNode);
      this.javascriptNode.connect(this.audioContext.destination);

      return true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  startRecording(callback) {
    if (!this.audioContext || !this.analyser) {
      throw new Error('Audio not initialized. Call initialize() first.');
    }

    this.isRecording = true;

    this.javascriptNode.onaudioprocess = () => {
      if (!this.isRecording) return;

      const buffer = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(buffer);

      const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(frequencyData);

      if (callback) {
        callback({
          timeDomainData: buffer,
          frequencyData: frequencyData,
          sampleRate: this.audioContext.sampleRate
        });
      }
    };
  }

  stopRecording() {
    this.isRecording = false;
    if (this.javascriptNode) {
      this.javascriptNode.onaudioprocess = null;
    }
  }

  getTimeDomainData() {
    if (!this.analyser) return null;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    return buffer;
  }

  getFrequencyData() {
    if (!this.analyser) return null;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);
    return frequencyData;
  }

  getVolume() {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return 0;

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    return sum / frequencyData.length;
  }

  getSampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      return this.audioContext.resume();
    }
  }

  cleanup() {
    this.stopRecording();

    if (this.javascriptNode) {
      this.javascriptNode.disconnect();
      this.javascriptNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
  }
}

// Export for use in other modules
window.AudioManager = AudioManager;
