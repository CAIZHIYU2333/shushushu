// 数字人渲染 - 基础版本
// 注意：完整实现需要外部库 gaussian-splat-renderer-for-lam 和 Processor 类
// 此版本提供基础接口，完整功能后续添加

// EventTypes
const EventTypes = {
  ErrorReceived: 'ErrorReceived',
  MessageReceived: 'MessageReceived',
  StartSpeech: 'StartSpeech',
  EndSpeech: 'EndSpeech',
  StateChanged: 'StateChanged',
};

// TYVoiceChatState
const TYVoiceChatState = {
  Idle: 'Idle',
  Listening: 'Listening',
  Responding: 'Responding',
  Thinking: 'Thinking',
};

// 简化版EventEmitter（如果已存在则使用全局的，避免重复声明）
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

        removeAllListeners() {
          this.events = {};
        }
      }
      return SimpleEventEmitter;
    })();
  }
})();
const SimpleEventEmitter = window.SimpleEventEmitter;

class GaussianAvatar extends SimpleEventEmitter {
  constructor(options) {
    super();
    const { container, assetsPath, ws, downloadProgress, loadProgress } = options;
    
    this._avatarDivEle = container;
    this._assetsPath = assetsPath;
    this._ws = ws;
    this._renderer = null;
    this._processor = null;
    this._audioMute = false;
    this.curState = TYVoiceChatState.Idle;
    this._loadPercent = 0;
    this._downloadPercent = 0;

    this._downloadProgress = downloadProgress || (() => {});
    this._loadProgress = loadProgress || (() => {});

    this._init();
  }

  _init() {
    if (!this._avatarDivEle || !this._assetsPath || !this._ws) {
      throw new Error('Lack of necessary initialization parameters for gaussian render');
    }
    
    // TODO: 初始化Processor（需要processor.js）
    // this._processor = new Processor(this);
    
    this._bindEventTypes();
  }

  start() {
    this.getData();
    this.render();
  }

  async getData() {
    if (!this._ws) return;

    // 监听WebSocket消息
    this._ws.on('WS_MESSAGE', (data) => {
      if (this._downloadPercent < 1 || this._loadPercent < 1) {
        // 本地数字人未加载完成前，不处理数据
        return;
      }

      this.emit(EventTypes.MessageReceived, this.curState);

      // TODO: 处理数据（需要Processor）
      // if (this._processor) {
      //   this._processor.add({
      //     avatar_motion_data: {
      //       first_package: true,
      //       segment_num: 1,
      //       binary_size: data.size,
      //       use_binary_frame: false,
      //     },
      //   });
      //   this._processor.add({
      //     avatar_motion_data: {
      //       first_package: false,
      //       motion_data_slice: data,
      //       is_audio_mute: this._audioMute,
      //     },
      //   });
      // }
    });
  }

  async render() {
    // TODO: 使用 gaussian-splat-renderer-for-lam 库进行渲染
    // 暂时提供占位实现
    try {
      // 检查是否加载了外部库
      if (typeof window !== 'undefined' && window.GaussianSplats3D) {
        this._renderer = await window.GaussianSplats3D.GaussianSplatRenderer.getInstance(
          this._avatarDivEle,
          this._assetsPath,
          {
            getChatState: this.getChatState.bind(this),
            getExpressionData: this.getArkitFaceFrame.bind(this),
            downloadProgress: this._downloadProgress.bind(this),
            loadProgress: this._loadProgress.bind(this),
          },
        );
      } else {
        console.warn('GaussianSplats3D library not loaded. Avatar rendering disabled.');
        // 显示占位符
        this._avatarDivEle.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">数字人渲染库未加载</div>';
      }
    } catch (error) {
      console.error('Gaussian avatar render failed:', error);
      this._avatarDivEle.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f00;">渲染失败</div>';
    }
  }

  setAvatarMute(isMute) {
    this._audioMute = isMute;
    // TODO: 调用Processor的setMute
    // if (this._processor) {
    //   this._processor.setMute(isMute);
    // }
  }

  getChatState() {
    return this.curState;
  }

  getArkitFaceFrame() {
    // TODO: 从Processor获取
    // if (this._processor) {
    //   return this._processor.getArkitFaceFrame()?.arkitFace;
    // }
    return null;
  }

  interrupt() {
    if (this._ws) {
      this._ws.send('%interrupt%');
    }
    // TODO: 调用Processor的interrupt
    // if (this._processor) {
    //   this._processor.interrupt();
    // }
    this.curState = TYVoiceChatState.Idle;
    this.emit(EventTypes.StateChanged, this.curState);
  }

  sendSpeech(data) {
    if (this._ws) {
      this._ws.send(data);
    }
    this.curState = TYVoiceChatState.Listening;
    this.emit(EventTypes.StateChanged, this.curState);
    // TODO: 调用Processor的clear
    // if (this._processor) {
    //   this._processor.clear();
    // }
  }

  exit() {
    if (this._renderer && this._renderer.dispose) {
      this._renderer.dispose();
    }
    this.curState = TYVoiceChatState.Idle;
    this._downloadPercent = 0;
    this._loadPercent = 0;
    // TODO: 调用Processor的clear
    // if (this._processor) {
    //   this._processor.clear();
    // }
    this.removeAllListeners();
  }

  _bindEventTypes() {
    // 监听Player事件
    if (window.PlayerEventTypes) {
      // 这些事件需要从Player类触发
      // 暂时留空，后续添加Processor后实现
    }

    // 监听WebSocket关闭
    if (this._ws) {
      this._ws.on('WS_CLOSE', () => {
        this.exit();
      });
    }
  }
}

// 导出
window.GaussianAvatar = GaussianAvatar;
window.EventTypes = EventTypes;
window.TYVoiceChatState = TYVoiceChatState;

