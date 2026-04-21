// 播放器逻辑 - 音频播放器
// 使用全局的SimpleEventEmitter（如果不存在则创建，避免重复声明）
(function() {
  'use strict';
  if (typeof window.SimpleEventEmitter === 'undefined') {
    window.SimpleEventEmitter = (function() {
      'use strict';
      class SimpleEventEmitter {
        constructor() {
          this.events = {};
        }

        on(event, listener) {
          if (!this.events[event]) {
            this.events[event] = [];
          }
          this.events[event].push(listener);
        }

        emit(event, data) {
          if (this.events[event]) {
            this.events[event].forEach(listener => listener(data));
          }
        }
      }
      return SimpleEventEmitter;
    })();
  }
})();
const SimpleEventEmitter = window.SimpleEventEmitter;

// PlayerEventTypes
const PlayerEventTypes = {
  Player_StartSpeaking: 'Player_StartSpeaking',
  Player_WaitNextAudioClip: 'Player_WaitNextAudioClip',
};

class Player {
  static isTypedArray(data) {
    return (
      (data.byteLength &&
        data.buffer &&
        data.buffer.constructor === ArrayBuffer) ||
      data.constructor === ArrayBuffer
    );
  }

  constructor(option, ee) {
    this.id = this.generateId();
    this.ee = ee || new SimpleEventEmitter();
    this.option = {
      inputCodec: 'Int16',
      channels: 1,
      sampleRate: 8000,
      fftSize: 2048,
      onended: () => {},
      isMute: false,
      ...option,
    };
    this.samplesList = [];
    this.autoPlay = true;
    this.convertValue = this._getConvertValue();
    this.typedArray = this._getTypedArray();
    this.initAudioContext();
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = this.option.isMute ? 0 : 1;
    this.gainNode.connect(this.audioCtx.destination);
    this.startTime = this.audioCtx.currentTime;
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = this.option.fftSize;
  }

  async continue() {
    await this.audioCtx.resume();
  }

  destroy() {
    this.samplesList = [];
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = undefined;
    }
  }

  feed(audioOptions) {
    let { audio } = audioOptions;
    const { end_of_batch } = audioOptions;
    if (!audio) {
      return;
    }
    this._isSupported(audio);
    audio = this._getFormattedValue(audio);
    const data = new Float32Array(audio.length);
    data.set(audio, 0);
    const samples = {
      data,
      end_of_batch,
    };
    this.samplesList.push(samples);
    this.flush(samples, this.samplesList.length - 1);
  }

  flush(samples, index) {
    if (!(samples && this.autoPlay && this.audioCtx)) return;
    const { data, end_of_batch } = samples;
    if (this.bufferSource) {
      this.bufferSource.onended = () => {};
    }
    this.bufferSource = this.audioCtx.createBufferSource();
    if (typeof this.option.onended === 'function') {
      this.bufferSource.onended = () => {
        if (!end_of_batch && index === this.samplesList.length - 1) {
          this.ee.emit(PlayerEventTypes.Player_WaitNextAudioClip);
        }
        this.option.onended();
      };
    }
    const length = data.length / this.option.channels;
    const audioBuffer = this.audioCtx.createBuffer(
      this.option.channels,
      length,
      this.option.sampleRate,
    );

    for (let channel = 0; channel < this.option.channels; channel++) {
      const audioData = audioBuffer.getChannelData(channel);
      let offset = channel;
      let decrement = 50;
      for (let i = 0; i < length; i++) {
        audioData[i] = data[offset];
        // fadein
        if (i < 50) {
          audioData[i] = (audioData[i] * i) / 50;
        }
        // fadeout
        if (i >= length - 51) {
          audioData[i] = (audioData[i] * decrement--) / 50;
        }
        offset += this.option.channels;
      }
    }

    if (this.startTime < this.audioCtx.currentTime) {
      this.startTime = this.audioCtx.currentTime;
    }
    this.bufferSource.buffer = audioBuffer;
    this.bufferSource.connect(this.gainNode);
    this.bufferSource.connect(this.analyserNode);
    this.bufferSource.start(this.startTime);
    samples.startTime = this.startTime;
    if (this._firstStartAbsoluteTime === undefined) {
      this._firstStartAbsoluteTime = Date.now();
    }
    if (this._firstStartRelativeTime === undefined) {
      this._firstStartRelativeTime = this.startTime;
      this.ee.emit(PlayerEventTypes.Player_StartSpeaking, this);
    }
    this.startTime += audioBuffer.duration;
  }

  setMute(isMute) {
    this.gainNode.gain.value = isMute ? 0 : 1;
  }

  async pause() {
    await this.audioCtx.suspend();
  }

  async updateAutoPlay(value) {
    if (this.autoPlay !== value && value) {
      this.autoPlay = value;
      this.samplesList.forEach((sample, index) => {
        this.flush(sample, index);
      });
    } else {
      this.autoPlay = value;
    }
  }

  volume(volume) {
    this.gainNode.gain.value = volume;
  }

  _getFormattedValue(data) {
    const TargetArray = this.typedArray;
    if (data.constructor === ArrayBuffer) {
      data = new TargetArray(data);
    } else {
      data = new TargetArray(data.buffer);
    }

    const float32 = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      float32[i] = data[i] / this.convertValue;
    }
    return float32;
  }

  _isSupported(data) {
    if (!Player.isTypedArray(data)) {
      throw new Error('请传入ArrayBuffer或者任意TypedArray');
    }
    return true;
  }

  _getConvertValue() {
    const inputCodecs = {
      Int8: 128,
      Int16: 32768,
      Int32: 2147483648,
      Float32: 1,
    };
    if (!inputCodecs[this.option.inputCodec]) {
      throw new Error('wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32');
    }
    return inputCodecs[this.option.inputCodec];
  }

  _getTypedArray() {
    const typedArrays = {
      Int8: Int8Array,
      Int16: Int16Array,
      Int32: Int32Array,
      Float32: Float32Array,
    };
    if (!typedArrays[this.option.inputCodec]) {
      throw new Error('wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32');
    }
    return typedArrays[this.option.inputCodec];
  }
}

// 导出
window.Player = Player;
window.PlayerEventTypes = PlayerEventTypes;

