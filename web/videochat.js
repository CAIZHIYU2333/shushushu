// 视频聊天主逻辑 - 基础版本
// 其他复杂功能（WebRTC、聊天、ActionGroup等）后续添加

class VideoChatManager {
  constructor() {
    this.config = {
      rtcConfig: undefined,
      avatarType: '',
      avatarWSRoute: '',
      avatarAssetsPath: '',
      trackConstraints: {
        video: { width: 500, height: 500 },
        audio: true,
      },
    };
    
    this.state = {
      streamState: 'closed', // 'closed', 'waiting', 'open'
      stream: null,
      peerConnection: null,
      localStream: null,
      webcamAccessed: false,
      hasCamera: false,
      hasMic: false,
      hasCameraPermission: true,
      hasMicPermission: true,
      cameraOff: false,
      micMuted: false,
      volumeMuted: false,
      showChatRecords: false,
      chatRecords: [],
      replying: false,
      chatDataChannel: null,
      // 多对话管理
      chats: [], // 对话列表
      currentChatId: null, // 当前对话ID
      // 状态提示和计时
      speechRecognitionStartTime: null, // 语音识别完成时间
      firstTokenReceived: false,
      firstVideoFrameReceived: false,
      firstTokenTime: null,
      firstVideoFrameTime: null,
    };
    
    // 计时器相关（不在state中，因为不需要持久化）
    this.timingInterval = null;
    this.videoFrameDetectionHandler = null;

    this.elements = {};
    this.init();
  }

  init() {
    // 增加今日会话计数
    this.incrementSessionCount();
    
    // 获取DOM元素 - 适配新的微信风格HTML结构
    this.elements = {
      wechatContainer: document.getElementById('wechat-container'),
      webcamPermission: document.getElementById('webcam-permission'),
      localVideo: document.getElementById('local-video'),
      remoteVideo: document.getElementById('remote-video'),
      remoteCanvas: document.getElementById('remote-canvas'),
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      chatSendBtn: document.getElementById('chat-send-btn'),
      avatarVideoPanel: document.getElementById('avatar-video-panel'),
      avatarVideoToggle: document.getElementById('avatar-video-toggle'),
      avatarVideoContent: document.getElementById('avatar-video-content'),
      avatarVideoWrapper: document.getElementById('avatar-video-wrapper'),
      localVideoWrapper: document.getElementById('local-video-wrapper'),
      avatarLoading: document.getElementById('avatar-loading'),
      typingIndicator: document.getElementById('typing-indicator'),
      consoleBtn: document.getElementById('console-btn'),
      chatStatus: document.getElementById('chat-status'),
      // 状态提示框
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      statusTimer: document.getElementById('status-timer'),
      // 视频控制按钮
      cameraToggle: document.getElementById('camera-toggle'),
      micToggle: document.getElementById('mic-toggle'),
      volumeToggle: document.getElementById('volume-toggle'),
      endCall: document.getElementById('end-call'),
      // 侧边栏和导航
      sidebarNavItems: document.querySelectorAll('.nav-item'),
      chatList: document.getElementById('chat-list'),
      searchInput: document.getElementById('search-input'),
      // 通话控制按钮（双状态：开始/结束）
      callToggleBtn: document.getElementById('call-toggle-btn'),
      sidebarSettingsBtn: document.getElementById('sidebar-settings-btn'),
      newChatBtn: document.getElementById('new-chat-btn'),
      chatList: document.getElementById('chat-list'),
      chatHeaderName: document.getElementById('chat-header-name'),
      // 输入区域
      chatInputArea: document.getElementById('chat-input-area'),
    };

    // 初始化配置
    this.loadConfig();
    
    // 初始化对话管理
    this.initChatManager();
    
    // 绑定事件
    this.bindEvents();
    
    // 初始化UI
    this.updateUI();
    
    // 初始化Lucide图标
    this.initLucideIcons();
  }

  initLucideIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  async loadConfig() {
    try {
      const response = await fetch('/openavatarchat/initconfig');
      const config = await response.json();
      
      if (config.rtc_configuration) {
        this.config.rtcConfig = config.rtc_configuration;
      }
      
      if (config.avatar_config) {
        this.config.avatarType = config.avatar_config.avatar_type || '';
        this.config.avatarWSRoute = config.avatar_config.avatar_ws_route || '';
        this.config.avatarAssetsPath = config.avatar_config.avatar_assets_path || '';
      }
      
      if (config.track_constraints) {
        this.config.trackConstraints = config.track_constraints;
      }
      
      console.log('配置加载完成:', this.config);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  bindEvents() {
    // 控制台按钮
    if (this.elements.consoleBtn) {
      this.elements.consoleBtn.addEventListener('click', () => {
        if (window.router) {
          window.router.navigate('/console');
        } else {
          window.location.href = '/ui/console.html';
        }
      });
    }

    // 摄像头权限覆盖层点击
    if (this.elements.webcamPermission) {
      this.elements.webcamPermission.addEventListener('click', () => {
        this.accessDevice();
      });
    }

    // 发送消息按钮
    if (this.elements.chatSendBtn) {
      this.elements.chatSendBtn.addEventListener('click', () => {
        this.sendMessage();
      });
    }

    // 输入框回车发送
    if (this.elements.chatInput) {
      this.elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // 数字人视频窗口折叠/展开
    if (this.elements.avatarVideoToggle) {
      this.elements.avatarVideoToggle.addEventListener('click', () => {
        this.toggleAvatarVideo();
      });
    }

    // 用户视频框点击切换位置和大小
    if (this.elements.localVideoWrapper) {
      this.elements.localVideoWrapper.addEventListener('click', () => {
        this.swapVideoPositions();
      });
    }

    // 数字人视频点击切换位置和大小
    if (this.elements.avatarVideoWrapper) {
      this.elements.avatarVideoWrapper.addEventListener('click', (e) => {
        // 如果点击的不是用户视频框，则切换
        if (!this.elements.localVideoWrapper.contains(e.target)) {
          this.swapVideoPositions();
        }
      });
    }

    // 通话控制按钮（双状态）
    if (this.elements.callToggleBtn) {
      this.elements.callToggleBtn.addEventListener('click', () => {
        if (this.state.streamState === 'closed') {
          this.startVideoCall();
        } else {
          this.stopChat();
        }
      });
    }

    // 侧边栏设置按钮
    if (this.elements.sidebarSettingsBtn) {
      this.elements.sidebarSettingsBtn.addEventListener('click', () => {
        if (window.router) {
          window.router.navigate('/console');
        } else {
          window.location.href = '/ui/console.html';
        }
      });
    }

    // 教学辅助平台按钮
    const teachingBtn = document.getElementById('teaching-btn');
    if (teachingBtn) {
      teachingBtn.addEventListener('click', () => {
        window.location.href = '/ui/teaching.html';
      });
    }

    // 视频控制按钮
    if (this.elements.cameraToggle) {
      this.elements.cameraToggle.addEventListener('click', () => {
        this.toggleCamera();
      });
    }
    if (this.elements.micToggle) {
      this.elements.micToggle.addEventListener('click', () => {
        this.toggleMic();
      });
    }

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.updateLayout();
    });

    // 监听输入框高度变化（当用户输入多行时）
    if (this.elements.chatInput) {
      const resizeObserver = new ResizeObserver(() => {
        this.updateAvatarVideoPanelHeight();
      });
      if (this.elements.chatInputArea) {
        resizeObserver.observe(this.elements.chatInputArea);
      }
    }
  }

  async accessDevice() {
    try {
      if (!navigator.mediaDevices) {
        alert('无法获取媒体设备，请确保用localhost访问或https协议访问');
        return;
      }

      // 请求权限
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        console.log('no audio permission');
        this.state.hasMicPermission = false;
      });

      await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {
        console.log('no video permission');
        this.state.hasCameraPermission = false;
      });

      // 获取设备列表
      const devices = window.streamUtils ? 
        await window.streamUtils.getDevices() : 
        await navigator.mediaDevices.enumerateDevices();
      console.log('设备列表:', devices);

      // 获取媒体流
      await this.getLocalStream();
      
      this.state.webcamAccessed = true;
      this.updateUI();
    } catch (error) {
      console.error('访问设备失败:', error);
      alert('访问设备失败: ' + error.message);
    }
  }

  async getLocalStream() {
    try {
      const audio = this.state.hasMicPermission ? this.config.trackConstraints.audio : false;
      const video = this.state.hasCameraPermission ? this.config.trackConstraints.video : false;

      // 使用stream-utils中的getStream函数
      let stream;
      if (window.streamUtils && window.streamUtils.getStream) {
        stream = await window.streamUtils.getStream(audio, video, this.config.trackConstraints);
      } else {
        const constraints = {
          video: video || false,
          audio: audio || false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      this.state.stream = stream;
      this.state.localStream = stream;

      // 检查设备
      this.state.hasCamera = stream.getVideoTracks().length > 0;
      this.state.hasMic = stream.getAudioTracks().length > 0;

      // 显示本地视频
      if (this.elements.localVideo && this.state.hasCamera) {
        if (window.streamUtils && window.streamUtils.setLocalStream) {
          window.streamUtils.setLocalStream(stream, this.elements.localVideo);
        } else {
          this.elements.localVideo.srcObject = stream;
          this.elements.localVideo.muted = true;
          await this.elements.localVideo.play();
        }
      }

      console.log('本地流获取成功:', stream);
    } catch (error) {
      console.error('获取本地流失败:', error);
      // 创建模拟流（如果没有设备）
      this.createSimulatedStream();
    }
  }

  createSimulatedStream() {
    // 使用stream-utils中的模拟轨道
    try {
      const stream = new MediaStream();
      if (window.streamUtils) {
        if (!this.state.hasCamera && window.streamUtils.createSimulatedVideoTrack) {
          stream.addTrack(window.streamUtils.createSimulatedVideoTrack());
        }
        if (!this.state.hasMic && window.streamUtils.createSimulatedAudioTrack) {
          stream.addTrack(window.streamUtils.createSimulatedAudioTrack());
        }
      }
      this.state.stream = stream;
      this.state.localStream = stream;
    } catch (error) {
      console.warn('创建模拟流失败:', error);
    }
  }

  async startChat() {
    if (this.state.streamState === 'closed') {
      // TODO: 实现WebRTC连接
      console.log('开始聊天 - WebRTC连接功能待实现');
      this.state.streamState = 'waiting';
      this.updateUI();
      
      // 暂时模拟连接成功
      setTimeout(() => {
        this.state.streamState = 'open';
        this.updateUI();
      }, 1000);
    } else if (this.state.streamState === 'open') {
      // 停止聊天
      this.stopChat();
    }
  }

  stopChat() {
    if (this.state.peerConnection) {
      // 使用webrtc.js中的stop函数
      if (window.webrtcUtils && window.webrtcUtils.stop) {
        window.webrtcUtils.stop(this.state.peerConnection);
      } else {
        this.state.peerConnection.close();
      }
      this.state.peerConnection = null;
    }
    
    // 停止本地流
    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
    }
    
    this.state.streamState = 'closed';
    this.state.chatRecords = [];
    this.state.chatDataChannel = null;
    this.state.replying = false;
    
    // 隐藏数字人视频窗口
    if (this.elements.avatarVideoPanel) {
      this.elements.avatarVideoPanel.style.display = 'none';
    }
    
    this.updateUI();
  }

  // 初始化数据通道消息监听
  initChatDataChannel() {
    if (!this.state.chatDataChannel) return;
    
    this.state.chatDataChannel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到数据通道消息:', data);
        
        if (data.type === 'chat') {
          // 如果是human消息，表示语音识别完成，开始计时
          // 注意：每次新的human消息都表示新的对话开始，需要重置并重新计时
          if (data.role === 'human') {
            // 如果已经有计时在进行，先重置（表示上一轮对话结束）
            if (this.state.speechRecognitionStartTime) {
              this.resetTimingState();
            }
            
            // 开始新的计时
            this.state.speechRecognitionStartTime = Date.now();
            this.showStatusIndicator('已识别，正在处理', 0); // 不自动隐藏，等视频首帧到达后再隐藏
            // 开始计时
            this.startTiming();
            // 设置视频首帧检测（每次新对话都需要重新设置）
            this.setupVideoFrameDetection();
            console.log('✅ 收到human消息（语音识别完成），开始计时');
          }
          
          // 检测文字首token（只检测avatar消息）
          if (data.role === 'avatar') {
            this.detectFirstToken(data);
          }
          
          // 流式输出消息
          this.handleStreamingMessage(data);
        } else if (data.type === 'avatar_end') {
          // 收到avatar_end表示处理结束
          this.state.replying = false;
          this.hideTypingIndicator();
          // 延迟重置，让用户看到最终时间
          setTimeout(() => {
            this.resetTimingState();
          }, 2000);
        }
      } catch (error) {
        console.error('解析数据通道消息失败:', error, event.data);
      }
    });
    
    // 监听数据通道打开
    this.state.chatDataChannel.addEventListener('open', () => {
      console.log('数据通道已打开');
      // 发送初始化消息
      if (this.state.chatDataChannel) {
        this.state.chatDataChannel.send(JSON.stringify({ type: 'init' }));
      }
    });
  }

  // 显示状态提示框
  showStatusIndicator(text, duration = 0) {
    if (!this.elements.statusIndicator || !this.elements.statusText) {
      console.warn('状态提示框元素未找到:', {
        statusIndicator: !!this.elements.statusIndicator,
        statusText: !!this.elements.statusText
      });
      return;
    }
    
    console.log('显示状态提示框:', text, 'duration:', duration);
    this.elements.statusText.textContent = text;
    // 清空计时器文本（如果有）
    if (this.elements.statusTimer) {
      this.elements.statusTimer.textContent = '';
    }
    // 移除hidden类（如果有），添加show类
    this.elements.statusIndicator.classList.remove('hidden');
    this.elements.statusIndicator.classList.add('show');
    
    if (duration > 0) {
      setTimeout(() => {
        this.hideStatusIndicator();
      }, duration);
    }
  }

  // 隐藏状态提示框
  hideStatusIndicator() {
    if (!this.elements.statusIndicator) return;
    console.log('隐藏状态提示框');
    this.elements.statusIndicator.classList.remove('show');
    this.elements.statusIndicator.classList.add('hidden');
  }

  // 更新状态计时器显示
  updateStatusTimer() {
    if (!this.elements.statusTimer) return;
    
    const now = Date.now();
    let timerText = '';
    
    if (this.state.speechRecognitionStartTime) {
      const elapsed = (now - this.state.speechRecognitionStartTime) / 1000;
      
      // 先显示文字首token（如果已到达）
      if (this.state.firstTokenTime) {
        const tokenDelay = (this.state.firstTokenTime - this.state.speechRecognitionStartTime) / 1000;
        timerText += `文字首token: ${tokenDelay.toFixed(2)}s`;
      } else {
        timerText += `等待文字首token: ${elapsed.toFixed(2)}s`;
      }
      
      // 只有当视频首帧到达后，才显示视频的计时
      if (this.state.firstVideoFrameTime) {
        const videoDelay = (this.state.firstVideoFrameTime - this.state.speechRecognitionStartTime) / 1000;
        timerText += `\n视频首帧: ${videoDelay.toFixed(2)}s`;
      }
      // 注意：视频未到达时不显示视频计时
      
      this.elements.statusTimer.textContent = timerText;
    }
  }

  // 开始计时
  startTiming() {
    // 重置状态
    this.state.firstTokenReceived = false;
    this.state.firstVideoFrameReceived = false;
    this.state.firstTokenTime = null;
    this.state.firstVideoFrameTime = null;
    
    // 启动定时器更新显示
    this.timingInterval = setInterval(() => {
      this.updateStatusTimer();
    }, 100); // 每100ms更新一次
  }

  // 重置计时器状态
  resetTimingState() {
    if (this.timingInterval) {
      clearInterval(this.timingInterval);
      this.timingInterval = null;
    }
    
    // 清理视频帧检测监听器
    if (this.videoFrameDetectionHandler && this.elements.remoteVideo) {
      this.elements.remoteVideo.removeEventListener('playing', this.videoFrameDetectionHandler);
      this.elements.remoteVideo.removeEventListener('loadeddata', this.videoFrameDetectionHandler);
      this.videoFrameDetectionHandler = null;
    }
    
    this.state.speechRecognitionStartTime = null;
    this.state.firstTokenReceived = false;
    this.state.firstVideoFrameReceived = false;
    this.state.firstTokenTime = null;
    this.state.firstVideoFrameTime = null;
    this.hideStatusIndicator();
  }

  // 检测文字首token
  detectFirstToken(data) {
    // 只检测数字人回复的首token（role === 'avatar'）
    if (data.role === 'avatar' && !this.state.firstTokenReceived && this.state.speechRecognitionStartTime) {
      // 确保消息内容不为空
      if (!data.message || !data.message.trim()) {
        return;
      }
      
      this.state.firstTokenReceived = true;
      this.state.firstTokenTime = Date.now();
      const delay = (this.state.firstTokenTime - this.state.speechRecognitionStartTime) / 1000;
      
      console.log(`✅ 文字首token到达: ${delay.toFixed(2)}秒`);
      this.updateStatusTimer();
      
      // 继续运行定时器，等待视频首帧
      // 定时器会在视频首帧到达后停止（在setupVideoFrameDetection中）
    }
  }

  // 设置视频首帧检测
  setupVideoFrameDetection() {
    if (!this.elements.remoteVideo) return;
    
    // 先清理之前的监听器（如果有）
    if (this.videoFrameDetectionHandler) {
      this.elements.remoteVideo.removeEventListener('playing', this.videoFrameDetectionHandler);
      this.elements.remoteVideo.removeEventListener('loadeddata', this.videoFrameDetectionHandler);
      this.videoFrameDetectionHandler = null;
    }
    
    // 记录当前对话的开始时间，用于判断是否是新对话
    const currentStartTime = this.state.speechRecognitionStartTime;
    
    // 监听视频播放事件
    const onVideoFrame = () => {
      // 检查是否还是当前对话（防止旧对话的监听器触发）
      if (this.state.speechRecognitionStartTime === currentStartTime && 
          !this.state.firstVideoFrameReceived && 
          this.state.speechRecognitionStartTime) {
        this.state.firstVideoFrameReceived = true;
        this.state.firstVideoFrameTime = Date.now();
        const delay = (this.state.firstVideoFrameTime - this.state.speechRecognitionStartTime) / 1000;
        
        console.log(`✅ 视频首帧到达: ${delay.toFixed(2)}秒`);
        this.updateStatusTimer();
        
        // 停止定时器更新（视频已到达）
        if (this.timingInterval) {
          clearInterval(this.timingInterval);
          this.timingInterval = null;
        }
        
        // 延迟2秒后隐藏状态提示框，让用户看到最终时间
        setTimeout(() => {
          this.hideStatusIndicator();
        }, 2000);
        
        // 移除监听器
        this.elements.remoteVideo.removeEventListener('playing', onVideoFrame);
        this.elements.remoteVideo.removeEventListener('loadeddata', onVideoFrame);
        this.videoFrameDetectionHandler = null;
      }
    };
    
    // 保存监听器引用，以便后续清理
    this.videoFrameDetectionHandler = onVideoFrame;
    
    // 如果视频已经在播放，延迟一点检测（确保是新对话的视频帧）
    if (this.elements.remoteVideo.readyState >= 2 && this.elements.remoteVideo.videoWidth > 0) {
      setTimeout(() => {
        onVideoFrame();
      }, 100);
    } else {
      // 否则等待视频加载
      this.elements.remoteVideo.addEventListener('playing', onVideoFrame, { once: true });
      this.elements.remoteVideo.addEventListener('loadeddata', onVideoFrame, { once: true });
    }
  }

  // 处理流式消息
  handleStreamingMessage(data) {
    if (!this.elements.chatMessages) return;
    
    const { id, message, role } = data;
    
    // 只处理数字人的回复消息（role === 'avatar'）
    if (role !== 'avatar') {
      return;
    }
    
    // 查找是否已存在该消息（通过id）
    const existingMessage = Array.from(this.elements.chatMessages.children).find(
      (msgEl) => msgEl.dataset.messageId === id && msgEl.classList.contains('received')
    );
    
    if (existingMessage) {
      // 追加消息内容（流式输出）
      const messageTextEl = existingMessage.querySelector('.message-text');
      if (messageTextEl) {
        // 使用textContent而不是innerHTML，避免XSS攻击
        messageTextEl.textContent += message;
        // 滚动到底部
        this.scrollToBottom();
      }
    } else {
      // 创建新消息（数字人回复的第一段）
      // 隐藏"正在输入"提示
      this.hideTypingIndicator();
      this.state.replying = true;
      
      // 移除欢迎消息
      const welcomeMsg = this.elements.chatMessages.querySelector('.welcome-message');
      if (welcomeMsg) {
        welcomeMsg.remove();
      }
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message-bubble received';
      messageDiv.dataset.messageId = id; // 保存消息ID用于流式更新
      
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      messageDiv.innerHTML = `
        <div class="message-avatar">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%2307c160'/%3E%3Ctext x='50' y='65' font-size='40' text-anchor='middle' fill='white'%3E🤖%3C/text%3E%3C/svg%3E" alt="数字人">
        </div>
        <div class="message-content">
          <div class="message-text">${this.escapeHtml(message)}</div>
          <div class="message-time">${time}</div>
        </div>
      `;
      
      this.elements.chatMessages.appendChild(messageDiv);
      this.scrollToBottom();
    }
  }

  // 发送消息
  sendMessage() {
    if (!this.elements.chatInput) return;
    const text = this.elements.chatInput.value.trim();
    if (!text) return;

    // 检查数据通道是否可用
    if (!this.state.chatDataChannel || this.state.chatDataChannel.readyState !== 'open') {
      alert('数据通道未连接，请先启动视频通话');
      return;
    }

    // 添加消息到界面
    this.addMessage(text, 'user');
    
    // 清空输入框
    this.elements.chatInput.value = '';
    
    // 显示"正在输入"提示
    this.showTypingIndicator();
    this.state.replying = true;
    
    // 通过数据通道发送消息到后端
    try {
      this.state.chatDataChannel.send(JSON.stringify({ 
        type: 'chat', 
        data: text 
      }));
      console.log('已发送消息:', text);
      
      // 对于文本输入，立即显示"已识别，正在处理"
      // 注意：语音识别的情况会在收到human消息时处理
      if (!this.state.speechRecognitionStartTime) {
        this.state.speechRecognitionStartTime = Date.now();
        this.showStatusIndicator('已识别，正在处理', 2000); // 2秒后自动隐藏
        // 开始计时
        this.startTiming();
        // 设置视频首帧检测
        this.setupVideoFrameDetection();
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送消息失败: ' + error.message);
    }
  }

  // 添加消息到聊天界面
  addMessage(text, type) {
    this.addMessageToUI(text, type, true);
    
    // 更新当前对话的最后消息
    if (this.state.currentChatId) {
      this.updateCurrentChatLastMessage(text, type);
    }
  }

  // 添加消息到UI（不保存）
  addMessageToUI(text, type, updateChat = true) {
    if (!this.elements.chatMessages) return;
    
    // 移除欢迎消息
    const welcomeMsg = this.elements.chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    const isSent = type === 'user';
    messageDiv.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 使用SVG图标替代emoji
    const userIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const avatarIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="9" r="2"></circle><path d="M8 19h8M12 15v4"></path></svg>`;
    
    messageDiv.innerHTML = `
      <div class="message-avatar">
        <div style="width: 100%; height: 100%; background: ${isSent ? '#7873f6' : '#07c160'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box;">
          ${isSent ? userIcon : avatarIcon}
        </div>
      </div>
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
      </div>
    `;
    
    this.elements.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 滚动到底部
  scrollToBottom() {
    if (this.elements.chatMessages) {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
  }

  // 显示"正在输入"提示
  showTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.classList.remove('hidden');
      this.scrollToBottom();
    }
  }

  // 隐藏"正在输入"提示
  hideTypingIndicator() {
    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.classList.add('hidden');
    }
  }

  // 切换数字人视频窗口
  toggleAvatarVideo() {
    if (!this.elements.avatarVideoPanel || !this.elements.avatarVideoContent) return;
    
    const isCollapsed = this.elements.avatarVideoPanel.classList.contains('collapsed');
    
    if (isCollapsed) {
      this.elements.avatarVideoPanel.classList.remove('collapsed');
      this.elements.avatarVideoContent.style.display = 'flex';
      if (this.elements.avatarVideoToggle) {
        this.elements.avatarVideoToggle.textContent = '−';
      }
      // 调整消息区域位置
      if (this.elements.chatMessages) {
        this.elements.chatMessages.style.marginLeft = '35%';
      }
    } else {
      this.elements.avatarVideoPanel.classList.add('collapsed');
      this.elements.avatarVideoContent.style.display = 'none';
      if (this.elements.avatarVideoToggle) {
        this.elements.avatarVideoToggle.textContent = '+';
      }
      // 消息区域占满
      if (this.elements.chatMessages) {
        this.elements.chatMessages.style.marginLeft = '0';
      }
    }
  }

  // 切换视频位置和大小（类似微信视频通话）
  swapVideoPositions() {
    if (!this.elements.avatarVideoWrapper || !this.elements.localVideoWrapper) return;
    
    const isSwapped = this.elements.avatarVideoWrapper.classList.contains('swapped');
    
    if (isSwapped) {
      // 切换回原位置：数字人大，用户小
      this.elements.avatarVideoWrapper.classList.remove('swapped');
      this.elements.localVideoWrapper.classList.remove('swapped');
    } else {
      // 切换位置：用户大，数字人小
      this.elements.avatarVideoWrapper.classList.add('swapped');
      this.elements.localVideoWrapper.classList.add('swapped');
    }
  }

  // 切换摄像头
  toggleCamera() {
    if (!this.state.localStream) return;
    
    const videoTracks = this.state.localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      this.state.cameraOff = !this.state.cameraOff;
      videoTracks[0].enabled = !this.state.cameraOff;
      
      if (this.elements.localVideo) {
        this.elements.localVideo.style.opacity = this.state.cameraOff ? '0.5' : '1';
      }
      
      if (this.elements.cameraToggle) {
        this.elements.cameraToggle.classList.toggle('active', !this.state.cameraOff);
      }
    }
  }

  // 切换麦克风
  toggleMic() {
    if (!this.state.localStream) return;
    
    const audioTracks = this.state.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      this.state.micMuted = !this.state.micMuted;
      audioTracks[0].enabled = !this.state.micMuted;
      
      if (this.elements.micToggle) {
        this.elements.micToggle.classList.toggle('active', !this.state.micMuted);
      }
    }
  }

  updateUI() {
    // 更新摄像头权限覆盖层
    if (this.elements.webcamPermission) {
      if (this.state.webcamAccessed) {
        this.elements.webcamPermission.classList.add('hidden');
      } else {
        this.elements.webcamPermission.classList.remove('hidden');
      }
    }

    // 更新数字人视频窗口
    if (this.elements.avatarVideoPanel) {
      if (this.state.streamState === 'open') {
        this.elements.avatarVideoPanel.style.display = 'flex';
        this.elements.avatarVideoPanel.classList.remove('collapsed');
        if (this.elements.avatarVideoContent) {
          this.elements.avatarVideoContent.style.display = 'flex';
        }
        // 隐藏等待动画（视频已连接）
        if (this.elements.avatarLoading) {
          this.elements.avatarLoading.classList.add('hidden');
          this.elements.avatarLoading.style.setProperty('display', 'none', 'important');
          this.elements.avatarLoading.style.setProperty('visibility', 'hidden', 'important');
          this.elements.avatarLoading.style.setProperty('opacity', '0', 'important');
          this.elements.avatarLoading.style.setProperty('z-index', '-1', 'important');
        }
        // 动态计算输入框高度，确保数字人视频面板不覆盖输入框
        this.updateAvatarVideoPanelHeight();
        // 调整消息区域位置
        if (this.elements.chatMessages) {
          this.elements.chatMessages.style.marginLeft = '35%';
        }
      } else if (this.state.streamState === 'waiting') {
        // 等待连接状态：显示数字人视频窗口和等待动画
        // 但只有在视频确实还没加载时才显示等待动画
        const videoLoaded = this.elements.remoteVideo && 
                           this.elements.remoteVideo.srcObject && 
                           (this.elements.remoteVideo.readyState >= 2 || 
                            this.elements.remoteVideo.videoWidth > 0);
        
        if (!videoLoaded) {
          console.log('updateUI: waiting状态，显示等待动画');
          this.elements.avatarVideoPanel.style.display = 'flex';
          this.elements.avatarVideoPanel.classList.remove('collapsed');
          if (this.elements.avatarVideoContent) {
            this.elements.avatarVideoContent.style.display = 'flex';
          }
          // 显示等待动画
          if (this.elements.avatarLoading) {
            this.elements.avatarLoading.style.display = 'flex';
            this.elements.avatarLoading.style.visibility = 'visible';
            this.elements.avatarLoading.style.opacity = '1';
          }
          // 隐藏远程视频（还没连接）
          if (this.elements.remoteVideo) {
            this.elements.remoteVideo.style.display = 'none';
          }
          if (this.elements.remoteCanvas) {
            this.elements.remoteCanvas.style.display = 'none';
          }
        } else {
          // 视频已加载，不应该显示等待动画，直接切换到open状态
          console.log('updateUI: waiting状态但视频已加载，切换到open状态');
          this.state.streamState = 'open';
          if (this.elements.avatarLoading) {
            this.elements.avatarLoading.style.display = 'none';
          }
          if (this.elements.remoteVideo) {
            this.elements.remoteVideo.style.display = 'block';
          }
          if (this.elements.remoteCanvas) {
            this.elements.remoteCanvas.style.display = 'block';
          }
        }
        // 调整消息区域位置
        if (this.elements.chatMessages) {
          this.elements.chatMessages.style.marginLeft = '35%';
        }
      } else {
        this.elements.avatarVideoPanel.style.display = 'none';
        // 消息区域占满
        if (this.elements.chatMessages) {
          this.elements.chatMessages.style.marginLeft = '0';
        }
      }
    }

    // 更新聊天状态
    if (this.elements.chatStatus) {
      if (this.state.streamState === 'open') {
        this.elements.chatStatus.textContent = '在线';
        this.elements.chatStatus.style.color = '#07c160';
      } else if (this.state.streamState === 'waiting') {
        this.elements.chatStatus.textContent = '连接中...';
        this.elements.chatStatus.style.color = '#888';
      } else {
        this.elements.chatStatus.textContent = '离线';
        this.elements.chatStatus.style.color = '#888';
      }
    }

    // 更新远程视频
    if (this.elements.remoteVideo) {
      if (this.state.streamState === 'open') {
        this.elements.remoteVideo.style.display = 'block';
      } else {
        this.elements.remoteVideo.style.display = 'none';
      }
    }

    // 更新通话按钮状态
    if (this.elements.callToggleBtn) {
      const icon = this.elements.callToggleBtn.querySelector('.call-icon');
      const text = this.elements.callToggleBtn.querySelector('.call-text');
      
      if (this.state.streamState === 'closed') {
        // 开始通话状态 - 使用电话图标
        if (icon) {
          icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>`;
        }
        if (text) text.textContent = '开始通话';
        this.elements.callToggleBtn.classList.remove('danger');
      } else if (this.state.streamState === 'waiting') {
        // 连接中状态 - 使用加载图标
        if (icon) {
          icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2 A10 10 0 0 1 22 12" stroke-linecap="round"></path>
          </svg>`;
        }
        if (text) text.textContent = '连接中...';
        this.elements.callToggleBtn.classList.remove('danger');
      } else {
        // 结束通话状态 - 使用挂断图标
        if (icon) {
          icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            <line x1="2" y1="2" x2="22" y2="22"></line>
          </svg>`;
        }
        if (text) text.textContent = '结束通话';
        this.elements.callToggleBtn.classList.add('danger');
      }
    }
  }

  // 启动视频通话
  async startVideoCall() {
    console.log('启动视频通话...');
    
    // 1. 检查是否已获取设备权限
    if (!this.state.webcamAccessed) {
      await this.accessDevice();
      if (!this.state.webcamAccessed) {
        alert('需要摄像头和麦克风权限才能开始视频通话');
        return;
      }
    }

    // 2. 更新状态
    this.state.streamState = 'waiting';
    
    // 3. 显示数字人视频窗口和等待动画（在updateUI之前手动设置，确保立即显示）
    if (this.elements.avatarVideoPanel) {
      this.elements.avatarVideoPanel.style.display = 'flex';
      this.elements.avatarVideoPanel.classList.remove('collapsed');
      if (this.elements.avatarVideoContent) {
        this.elements.avatarVideoContent.style.display = 'flex';
      }
      // 强制显示等待动画
      if (this.elements.avatarLoading) {
        console.log('🔄 显示等待动画，元素:', this.elements.avatarLoading);
        console.log('🔄 元素当前样式:', window.getComputedStyle(this.elements.avatarLoading).display);
        this.elements.avatarLoading.style.display = 'flex';
        this.elements.avatarLoading.style.visibility = 'visible';
        this.elements.avatarLoading.style.opacity = '1';
        this.elements.avatarLoading.style.zIndex = '100';
        this.elements.avatarLoading.classList.remove('hidden');
        console.log('🔄 设置后样式:', window.getComputedStyle(this.elements.avatarLoading).display);
      } else {
        console.error('❌ avatarLoading元素不存在！');
        // 尝试重新查找元素
        const loadingEl = document.getElementById('avatar-loading');
        if (loadingEl) {
          console.log('✅ 重新找到avatar-loading元素');
          this.elements.avatarLoading = loadingEl;
          loadingEl.style.display = 'flex';
          loadingEl.style.visibility = 'visible';
          loadingEl.style.opacity = '1';
        } else {
          console.error('❌ 无法找到avatar-loading元素');
        }
      }
      // 隐藏远程视频（还没连接）
      if (this.elements.remoteVideo) {
        this.elements.remoteVideo.style.display = 'none';
      }
      if (this.elements.remoteCanvas) {
        this.elements.remoteCanvas.style.display = 'none';
      }
    } else {
      console.error('❌ avatarVideoPanel元素不存在！');
    }
    
    // 4. 更新UI
    this.updateUI();

    // 4. 启动WebRTC连接
    try {
      await this.setupWebRTC();
      // 注意：不要在这里立即设置为 'open'，等待视频流到达后再设置
      // 这样等待动画会一直显示直到视频真正显示出来
      console.log('WebRTC连接已建立，等待视频流...');
    } catch (error) {
      console.error('启动视频通话失败:', error);
      this.state.streamState = 'closed';
      this.updateUI();
      // 隐藏等待动画
      if (this.elements.avatarLoading) {
        this.elements.avatarLoading.style.display = 'none';
      }
      alert('启动视频通话失败: ' + error.message);
    }
  }

  // 设置WebRTC连接
  async setupWebRTC() {
    if (!window.webrtcUtils) {
      throw new Error('WebRTC工具未加载');
    }

    if (!this.state.localStream) {
      throw new Error('本地流未准备好');
    }

    // 创建RTCPeerConnection对象
    const pc = new RTCPeerConnection(this.config.rtcConfig || {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // 使用webrtcUtils的createPeerConnection来设置监听器
    window.webrtcUtils.createPeerConnection(pc, this.elements.remoteVideo);

    // 监听连接状态变化
    pc.addEventListener('connectionstatechange', () => {
      console.log('连接状态:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        // 连接成功，但等待视频流到达后再更新状态
        // 状态更新在 track 事件中处理
        console.log('WebRTC连接已建立，等待视频流...');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.state.streamState = 'closed';
        this.updateUI();
        // 隐藏等待动画
        if (this.elements.avatarLoading) {
          this.elements.avatarLoading.style.display = 'none';
        }
      }
    });

    // 监听远程视频流到达
    let videoTrackReceived = false; // 防止重复处理
    pc.addEventListener('track', (event) => {
      console.log('收到远程视频流:', event.track.kind);
      if (event.track.kind === 'video' && !videoTrackReceived) {
        videoTrackReceived = true;
        console.log('视频流已到达，准备显示...');
        
        // 立即更新状态为open，防止updateUI重新显示等待动画
        this.state.streamState = 'open';
        
        // 显示远程视频
        if (this.elements.remoteVideo) {
          this.elements.remoteVideo.style.display = 'block';
        }
        if (this.elements.remoteCanvas) {
          this.elements.remoteCanvas.style.display = 'block';
        }
        
        // 隐藏等待动画的函数（使用标志防止重复调用）
        let loadingHidden = false;
        const hideLoading = () => {
          if (loadingHidden) {
            console.log('等待动画已隐藏，跳过');
            return;
          }
          if (this.elements.avatarLoading) {
            console.log('✅ 隐藏等待动画');
            loadingHidden = true;
            // 使用多种方式确保隐藏
            this.elements.avatarLoading.style.display = 'none';
            this.elements.avatarLoading.style.visibility = 'hidden';
            this.elements.avatarLoading.style.opacity = '0';
            this.elements.avatarLoading.style.pointerEvents = 'none';
            this.elements.avatarLoading.classList.add('hidden');
            // 强制设置z-index
            this.elements.avatarLoading.style.zIndex = '-1';
            console.log('等待动画已隐藏，当前display:', window.getComputedStyle(this.elements.avatarLoading).display);
          } else {
            console.error('❌ avatarLoading元素不存在');
          }
          // 确保状态是open
          this.state.streamState = 'open';
          this.updateUI();
          console.log('✅ 视频通话已启动');
        };
        
        // 检查视频是否已经加载
        if (this.elements.remoteVideo) {
          // 如果视频已经有srcObject且readyState >= 2，立即隐藏
          if (this.elements.remoteVideo.srcObject && this.elements.remoteVideo.readyState >= 2) {
            console.log('视频已加载，立即隐藏等待动画');
            hideLoading();
          } else {
            // 等待视频加载完成
            console.log('等待视频加载完成...');
            const onLoaded = () => {
              console.log('视频加载完成，隐藏等待动画');
              hideLoading();
            };
            
            // 监听多个事件确保捕获到
            this.elements.remoteVideo.addEventListener('loadeddata', onLoaded, { once: true });
            this.elements.remoteVideo.addEventListener('canplay', onLoaded, { once: true });
            this.elements.remoteVideo.addEventListener('playing', onLoaded, { once: true });
            
            // 如果2秒后还没加载完成，强制隐藏（防止一直显示）
            setTimeout(() => {
              console.log('超时，强制隐藏等待动画');
              hideLoading();
            }, 2000);
          }
        } else {
          // 没有remoteVideo元素，直接隐藏
          hideLoading();
        }
        
        // 视频连接成功后，显示"请开始对话"提示（停留1秒）
        setTimeout(() => {
          this.showStatusIndicator('请开始对话', 1000);
        }, 100); // 稍微延迟，确保视频已显示
        
        // 监听视频首帧（用于检测响应时的视频首帧）
        // 注意：这里的setupVideoFrameDetection会在收到avatar_end后开始检测
      }
    });

    this.state.peerConnection = pc;

    // 添加本地流到PeerConnection
    this.state.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.state.localStream);
    });

    // 使用webrtcUtils的setupWebRTC来建立连接
    try {
      const [dataChannel, webrtc_id] = await window.webrtcUtils.setupWebRTC(
        this.state.localStream,
        pc,
        this.elements.remoteVideo
      );
      
      this.state.chatDataChannel = dataChannel;
      this.state.webrtcId = webrtc_id;
      
      // 初始化数据通道消息监听
      this.initChatDataChannel();
      
      console.log('WebRTC连接建立成功');
    } catch (error) {
      console.error('WebRTC连接失败:', error);
      throw error;
    }

    // 如果是数字人类型，初始化数字人
    if (this.config.avatarType) {
      await this.initAvatar();
    }
  }

  // 初始化数字人
  async initAvatar() {
    if (!window.GaussianAvatar) {
      console.warn('数字人工具未加载');
      return;
    }

    try {
      // 创建数字人实例
      const avatar = new window.GaussianAvatar({
        wsRoute: this.config.avatarWSRoute,
        assetsPath: this.config.avatarAssetsPath,
        canvas: this.elements.remoteCanvas,
        video: this.elements.remoteVideo,
      });

      // 连接WebSocket
      await avatar.connect();

      // 保存实例
      this.avatarInstance = avatar;

      console.log('数字人初始化成功');
    } catch (error) {
      console.error('数字人初始化失败:', error);
      throw error;
    }
  }

  // 更新数字人视频面板高度，确保不覆盖输入框
  updateAvatarVideoPanelHeight() {
    if (!this.elements.avatarVideoPanel || !this.elements.chatInputArea) return;
    
    const inputArea = this.elements.chatInputArea;
    const inputHeight = inputArea.offsetHeight;
    // 设置数字人视频面板的bottom值，留出输入框的高度
    this.elements.avatarVideoPanel.style.bottom = `${inputHeight}px`;
  }

  updateLayout() {
    // 更新布局（响应式）
    // 微信风格布局主要由CSS控制，这里可以添加额外的布局调整
    this.updateAvatarVideoPanelHeight();
  }

  // 初始化对话管理器
  initChatManager() {
    // 从本地存储加载对话
    this.loadChatsFromStorage();
    
    // 如果没有对话，创建默认对话
    if (this.state.chats.length === 0) {
      this.createNewChat('数字人助手');
    } else {
      // 切换到最新的对话
      const latestChat = this.state.chats[0];
      this.switchChat(latestChat.id);
    }
    
    // 绑定新对话按钮
    if (this.elements.newChatBtn) {
      this.elements.newChatBtn.addEventListener('click', () => {
        this.createNewChat('数字人助手');
      });
    }
  }

  // 创建新对话
  createNewChat(name = '数字人助手') {
    const chatId = 'chat-' + Date.now();
    const chat = {
      id: chatId,
      name: name,
      messages: [],
      lastMessage: '',
      lastMessageTime: Date.now(),
      createdAt: Date.now(),
      pinned: false, // 是否顶置
    };
    
    // 添加到列表开头
    this.state.chats.unshift(chat);
    this.state.currentChatId = chatId;
    
    // 保存到本地存储
    this.saveChatsToStorage();
    
    // 更新UI
    this.renderChatList();
    this.switchChat(chatId);
    
    return chat;
  }

  // 删除对话
  deleteChat(chatId) {
    const index = this.state.chats.findIndex(chat => chat.id === chatId);
    if (index === -1) return;
    
    this.state.chats.splice(index, 1);
    
    // 如果删除的是当前对话，切换到其他对话
    if (this.state.currentChatId === chatId) {
      if (this.state.chats.length > 0) {
        this.switchChat(this.state.chats[0].id);
      } else {
        this.state.currentChatId = null;
        this.createNewChat();
      }
    }
    
    // 保存到本地存储
    this.saveChatsToStorage();
    
    // 更新UI
    this.renderChatList();
  }

  // 切换对话
  switchChat(chatId) {
    const chat = this.state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    this.state.currentChatId = chatId;
    
    // 更新头部名称
    if (this.elements.chatHeaderName) {
      this.elements.chatHeaderName.textContent = chat.name;
    }
    
    // 清空并重新渲染消息
    if (this.elements.chatMessages) {
      this.elements.chatMessages.innerHTML = '';
      chat.messages.forEach(msg => {
        this.addMessageToUI(msg.text, msg.type, false);
      });
    }
    
    // 更新对话列表UI
    this.renderChatList();
  }

  // 顶置/取消顶置对话
  togglePinChat(chatId) {
    const chat = this.state.chats.find(c => c.id === chatId);
    if (!chat) return;
    
    chat.pinned = !chat.pinned;
    
    // 保存到本地存储
    this.saveChatsToStorage();
    
    // 更新UI
    this.renderChatList();
  }

  // 渲染对话列表
  renderChatList() {
    if (!this.elements.chatList) return;
    
    this.elements.chatList.innerHTML = '';
    
    // 按顶置和时间排序（顶置的在前，然后按时间排序）
    const sortedChats = [...this.state.chats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.lastMessageTime - a.lastMessageTime;
    });
    
    sortedChats.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = `chat-item ${chat.id === this.state.currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}`;
      chatItem.dataset.chatId = chat.id;
      
      const timeStr = this.formatTime(chat.lastMessageTime);
      
      chatItem.innerHTML = `
        <div class="chat-item-avatar">
          <svg class="avatar-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="12" cy="9" r="2"></circle>
            <path d="M8 19h8M12 15v4"></path>
          </svg>
        </div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-item-name">${this.escapeHtml(chat.name)}</span>
            <span class="chat-item-time">${timeStr}</span>
          </div>
          <div class="chat-item-preview">${this.escapeHtml(chat.lastMessage || '点击开始对话')}</div>
        </div>
        <div class="chat-item-actions">
          <button class="chat-item-pin" title="${chat.pinned ? '取消顶置' : '顶置'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </button>
          <button class="chat-item-delete" title="删除对话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
      
      // 绑定点击事件
      chatItem.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-item-actions')) {
          this.switchChat(chat.id);
        }
      });
      
      // 绑定顶置按钮
      const pinBtn = chatItem.querySelector('.chat-item-pin');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePinChat(chat.id);
        });
        if (chat.pinned) {
          pinBtn.classList.add('active');
        }
      }
      
      // 绑定删除按钮
      const deleteBtn = chatItem.querySelector('.chat-item-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('确定要删除这个对话吗？')) {
            this.deleteChat(chat.id);
          }
        });
      }
      
      this.elements.chatList.appendChild(chatItem);
    });
  }

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const chatDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (chatDate.getTime() === today.getTime()) {
      // 今天：显示时间
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (chatDate.getTime() === today.getTime() - 86400000) {
      // 昨天
      return '昨天';
    } else {
      // 更早：显示日期
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  }

  // 保存对话到本地存储
  saveChatsToStorage() {
    try {
      localStorage.setItem('videochat_chats', JSON.stringify(this.state.chats));
    } catch (e) {
      console.error('保存对话失败:', e);
    }
  }

  // 从本地存储加载对话
  loadChatsFromStorage() {
    try {
      const saved = localStorage.getItem('videochat_chats');
      if (saved) {
        this.state.chats = JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载对话失败:', e);
      this.state.chats = [];
    }
  }

  // 更新当前对话的最后消息
  updateCurrentChatLastMessage(message, type) {
    const chat = this.state.chats.find(c => c.id === this.state.currentChatId);
    if (!chat) return;
    
    chat.lastMessage = message;
    chat.lastMessageTime = Date.now();
    
    // 保存消息到对话
    chat.messages.push({
      text: message,
      type: type,
      time: Date.now(),
    });
    
    // 保存到本地存储
    this.saveChatsToStorage();
    
    // 更新对话列表显示
    this.renderChatList();
  }
}

// 增加会话计数的方法
VideoChatManager.prototype.incrementSessionCount = function() {
  const today = new Date().toDateString();
  const sessionKey = `daily_sessions_${today}`;
  const totalSessionsKey = 'total_sessions';
  
  // 获取今天的会话数
  let todayCount = parseInt(localStorage.getItem(sessionKey) || '0', 10);
  todayCount += 1;
  localStorage.setItem(sessionKey, todayCount.toString());
  
  // 更新总会话数
  let totalCount = parseInt(localStorage.getItem(totalSessionsKey) || '0', 10);
  totalCount += 1;
  localStorage.setItem(totalSessionsKey, totalCount.toString());
  
  console.log(`📊 会话计数已更新: 今日 ${todayCount}, 总计 ${totalCount}`);
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.videoChatManager = new VideoChatManager();
});

