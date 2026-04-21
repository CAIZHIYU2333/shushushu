// AI虚拟形象聊天系统 - 前端JavaScript (完整修复版)
class AvatarChatApp {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.localStream = null;
        this.peerConnection = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.isConnected = false;
        this.sessionStartTime = null;
        this.devices = {
            audio: [],
            video: []
        };
        this.history = []; // 存储当前会话历史
        this.avatarCheckInterval = null; // 数字人状态检查定时器
        this.currentUserRole = 'user'; // 当前用户角色
        
        // 页面加载完成后初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            this.init();
        }
    }

    // 初始化应用
    async init() {
        try {
            console.log('开始初始化应用...');
            this.showLoading(true);
            await this.initializeSocket();
            await this.loadDevices();
            await this.fetchServerConfig();
            this.initAvatarVideo();
            this.loadSettings();
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            // 加载历史记录列表
            await this.loadHistoryList();
            
            this.showLoading(false);
            this.showNotification('系统初始化完成', 'success');
            console.log('应用初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showNotification('系统初始化失败: ' + error.message, 'error');
            this.showLoading(false);
        }
    }

    // 初始化WebSocket连接
    async initializeSocket() {
        return new Promise((resolve, reject) => {
            try {
                // 创建WebSocket连接
                this.socket = io();
                
                this.socket.on('connect', () => {
                    console.log('WebSocket连接成功');
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    this.createSession();
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    console.log('WebSocket连接断开');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('WebSocket连接错误:', error);
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    reject(error);
                });

                // 监听聊天消息
                this.socket.on('chat_message', (data) => {
                    console.log('收到聊天消息:', data);
                    this.addMessageToChat('ai', data.content, 'AI助手');
                });

                // 监听流式聊天响应
                this.socket.on('chat_stream', (data) => {
                    this.handleChatStream(data);
                });

                // 监听流式聊天结束
                this.socket.on('chat_stream_end', (data) => {
                    this.handleChatStreamEnd(data);
                });

                // 监听TTS完成事件
                this.socket.on('tts_complete', (data) => {
                    console.log('TTS合成完成:', data);
                    // 可以在这里处理TTS完成后的操作
                });

                // 监听TTS音频事件
                this.socket.on('tts_audio', (data) => {
                    console.log('收到TTS音频数据:', data);
                    
                    // 验证数据有效性
                    if (!data || !data.audio_wav_base64) {
                        console.warn('接收到无效的TTS音频数据');
                        return;
                    }
                    
                    // 播放TTS音频
                    try {
                        this.playTTS(data.audio_wav_base64, data.format || 'wav');
                    } catch (error) {
                        console.error('播放TTS音频失败:', error);
                    }
                });

                // 监听数字人动画事件
                this.socket.on('avatar_animation', (data) => {
                    console.log('收到数字人动画数据:', data);
                    
                    // 验证数据有效性
                    if (!data) {
                        console.warn('接收到无效的动画数据');
                        return;
                    }
                    
                    // 处理数字人动画效果
                    this.handleAvatarAnimation(data);
                    
                    // 如果有表情数据，更新数字人状态显示
                    if (data.expression) {
                        this.updateAvatarStatus(data.expression);
                    }
                });

                // 监听错误消息
                this.socket.on('error', (data) => {
                    console.error('服务器错误:', data);
                    this.showNotification('服务器错误: ' + data.message, 'error');
                });
            } catch (error) {
                console.error('初始化WebSocket失败:', error);
                reject(error);
            }
        });
    }

    // 创建会话
    async createSession() {
        try {
            const response = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    avatar_type: 'liteavatar'
                })
            });

            const result = await response.json();
            if (result.success) {
                this.sessionId = result.session_id;
                console.log('会话创建成功:', this.sessionId);
            } else {
                throw new Error(result.error || '会话创建失败');
            }
        } catch (error) {
            console.error('创建会话失败:', error);
            this.showNotification('创建会话失败: ' + error.message, 'error');
        }
    }

    // 更新连接状态显示
    updateConnectionStatus(isConnected = this.isConnected) {
        const connectionDot = document.getElementById('connectionDot');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (isConnected) {
            connectionDot.className = 'status-dot connected';
            connectionStatus.textContent = '已连接';
        } else {
            connectionDot.className = 'status-dot disconnected';
            connectionStatus.textContent = '未连接';
        }
    }

    // 初始化数字人视频显示
    initAvatarVideo() {
        console.log('初始化数字人视频显示');
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarLoading = document.getElementById('avatarLoading');
        
        if (avatarVideo) {
            // 显示加载状态
            if (avatarLoading) {
                avatarLoading.style.display = 'flex';
            }
            
            // 尝试加载视频流
            avatarVideo.onload = () => {
                console.log('数字人视频加载成功');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
                this.updateAvatarStatus('已连接');
            };
            
            avatarVideo.onerror = () => {
                console.log('数字人视频加载失败');
                if (avatarLoading) {
                    avatarLoading.style.display = 'none';
                }
                this.updateAvatarStatus('连接失败');
                this.showNotification('数字人视频加载失败', 'error');
            };
        }
    }

    // 更新数字人状态显示
    updateAvatarStatus(status) {
        const avatarStatus = document.getElementById('avatarStatus');
        if (avatarStatus) {
            avatarStatus.textContent = status;
            avatarStatus.setAttribute('data-status', status);
        }
    }

    // 加载设备列表
    async loadDevices() {
        try {
            // 获取音频输入设备
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices.audio = devices.filter(device => device.kind === 'audioinput');
            this.devices.video = devices.filter(device => device.kind === 'videoinput');
            
            this.populateDeviceSelectors();
            
            console.log('加载设备完成:', this.devices);
        } catch (error) {
            console.error('加载设备失败:', error);
        }
    }

    // 填充设备选择器
    populateDeviceSelectors() {
        const audioDeviceSelect = document.getElementById('audioDevice');
        const videoDeviceSelect = document.getElementById('videoDevice');
        
        if (!audioDeviceSelect || !videoDeviceSelect) {
            console.warn('设备选择器元素未找到');
            return;
        }
        
        // 清空现有选项
        audioDeviceSelect.innerHTML = '<option value="">自动选择</option>';
        videoDeviceSelect.innerHTML = '<option value="">自动选择</option>';
        
        // 添加音频设备选项
        this.devices.audio.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `麦克风 ${audioDeviceSelect.children.length}`;
            audioDeviceSelect.appendChild(option);
        });
        
        // 添加视频设备选项
        this.devices.video.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `摄像头 ${videoDeviceSelect.children.length}`;
            videoDeviceSelect.appendChild(option);
        });
    }

    // 获取服务器配置
    async fetchServerConfig() {
        try {
            // 这里可以获取服务器配置信息
            console.log('获取服务器配置');
        } catch (error) {
            console.error('获取服务器配置失败:', error);
        }
    }

    // 加载设置
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('avatarChatSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                const audioDevice = document.getElementById('audioDevice');
                const videoDevice = document.getElementById('videoDevice');
                const avatarType = document.getElementById('avatarType');
                const avatarModel = document.getElementById('avatarModel');
                const aiModel = document.getElementById('aiModel');
                
                if (audioDevice && settings.audioDevice) audioDevice.value = settings.audioDevice;
                if (videoDevice && settings.videoDevice) videoDevice.value = settings.videoDevice;
                if (avatarType && settings.avatarType) avatarType.value = settings.avatarType;
                if (avatarModel && settings.avatarModel) avatarModel.value = settings.avatarModel;
                if (aiModel && settings.aiModel) aiModel.value = settings.aiModel;
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        console.log('开始设置事件监听器...');
        
        // 发送按钮
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    this.sendChatMessage(messageInput.value);
                    messageInput.value = '';
                }
            });
        } else {
            console.warn('发送按钮未找到');
        }
        
        // 消息输入框
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage(messageInput.value);
                    messageInput.value = '';
                }
            });
        } else {
            console.warn('消息输入框未找到');
        }
        
        // 语音按钮
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            let voicePressTimer = null;
            
            voiceBtn.addEventListener('mousedown', () => {
                voicePressTimer = setTimeout(() => {
                    this.startVoiceRecording();
                }, 300); // 长按300ms开始录音
            });
            
            voiceBtn.addEventListener('mouseup', () => {
                clearTimeout(voicePressTimer);
                this.stopVoiceRecording();
            });
            
            voiceBtn.addEventListener('mouseleave', () => {
                clearTimeout(voicePressTimer);
                this.stopVoiceRecording();
            });
        } else {
            console.warn('语音按钮未找到');
        }
        
        // 清空聊天按钮
        const clearChat = document.getElementById('clearChat');
        if (clearChat) {
            clearChat.addEventListener('click', () => {
                this.clearChatHistory();
            });
        } else {
            console.warn('清空聊天按钮未找到');
        }
        
        // 全屏数字人按钮
        const toggleVideoView = document.getElementById('toggleVideoView');
        if (toggleVideoView) {
            toggleVideoView.addEventListener('click', () => {
                this.toggleFullscreenAvatar();
            });
        } else {
            console.warn('全屏数字人按钮未找到');
        }
        
        // 收起聊天框按钮
        const toggleChatView = document.getElementById('toggleChatView');
        if (toggleChatView) {
            toggleChatView.addEventListener('click', () => {
                this.toggleChatView();
            });
        } else {
            console.warn('收起聊天框按钮未找到');
        }
        
        // 开始对话按钮
        const avatarToggle = document.getElementById('avatarToggle');
        if (avatarToggle) {
            avatarToggle.addEventListener('click', async () => {
                try {
                    if (!this.localStream) {
                        this.showButtonFeedback(avatarToggle, '正在启动摄像头和麦克风...', 'info');
                        await this.startLocalStream();
                        avatarToggle.innerHTML = '<i class="fas fa-pause"></i><span>停止对话</span>';
                        avatarToggle.classList.add('active');
                        this.showButtonFeedback(avatarToggle, '对话已开始，可以开始语音或文字交流', 'success');
                    } else {
                        this.showButtonFeedback(avatarToggle, '正在停止对话...', 'info');
                        await this.stopLocalStream();
                        avatarToggle.innerHTML = '<i class="fas fa-play"></i><span>开始对话</span>';
                        avatarToggle.classList.remove('active');
                        this.showButtonFeedback(avatarToggle, '对话已停止', 'success');
                    }
                } catch (error) {
                    console.error('切换对话状态失败:', error);
                    this.showButtonFeedback(avatarToggle, '启动失败: ' + error.message, 'error');
                }
            });
        } else {
            console.warn('开始对话按钮未找到');
        }
        
        // 麦克风控制
        const micToggle = document.getElementById('micToggle');
        if (micToggle) {
            micToggle.addEventListener('click', () => {
                if (this.localStream) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        audioTrack.enabled = !audioTrack.enabled;
                        micToggle.classList.toggle('inactive');
                        micToggle.classList.toggle('active');
                        
                        const status = audioTrack.enabled ? '已开启' : '已关闭';
                        this.showButtonFeedback(micToggle, `麦克风${status}`, 'success');
                    }
                } else {
                    this.showButtonFeedback(micToggle, '请先开始对话', 'warning');
                }
            });
        } else {
            console.warn('麦克风控制按钮未找到');
        }
        
        // 摄像头控制
        const cameraToggle = document.getElementById('cameraToggle');
        if (cameraToggle) {
            cameraToggle.addEventListener('click', () => {
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        videoTrack.enabled = !videoTrack.enabled;
                        cameraToggle.classList.toggle('inactive');
                        cameraToggle.classList.toggle('active');
                        
                        const status = videoTrack.enabled ? '已开启' : '已关闭';
                        this.showButtonFeedback(cameraToggle, `摄像头${status}`, 'success');
                    }
                } else {
                    this.showButtonFeedback(cameraToggle, '请先开始对话', 'warning');
                }
            });
        } else {
            console.warn('摄像头控制按钮未找到');
        }
        
        // 文件上传
        const fileUploadInput = document.getElementById('fileUploadInput');
        if (fileUploadInput) {
            fileUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.uploadFile(file);
                }
            });
        }
        
        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                // 加载历史记录列表
                this.loadHistoryList();
                if (settingsModal) {
                    settingsModal.classList.add('show');
                }
            });
        } else {
            console.warn('设置按钮未找到');
        }
        
        if (closeSettings && settingsModal) {
            closeSettings.addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });
        }
        
        if (cancelSettings && settingsModal) {
            cancelSettings.addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });
        }
        
        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveSettings();
                if (settingsModal) {
                    settingsModal.classList.remove('show');
                }
            });
        }
        
        // 帮助按钮
        const helpBtn = document.getElementById('helpBtn');
        const helpModal = document.getElementById('helpModal');
        const closeHelp = document.getElementById('closeHelp');
        
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                if (helpModal) {
                    helpModal.classList.add('show');
                }
            });
        } else {
            console.warn('帮助按钮未找到');
        }
        
        if (closeHelp && helpModal) {
            closeHelp.addEventListener('click', () => {
                helpModal.classList.remove('show');
            });
        }
        
        // 知识库按钮
        const knowledgeBaseBtn = document.getElementById('knowledgeBaseBtn');
        const knowledgeBaseModal = document.getElementById('knowledgeBaseModal');
        const closeKnowledgeBase = document.getElementById('closeKnowledgeBase');
        const closeKnowledgeBaseBtn = document.getElementById('closeKnowledgeBaseBtn');
        const knowledgeSearch = document.getElementById('knowledgeSearch');
        
        if (knowledgeBaseBtn) {
            knowledgeBaseBtn.addEventListener('click', async () => {
                if (knowledgeBaseModal) {
                    knowledgeBaseModal.classList.add('show');
                    // 加载知识库内容
                    await this.loadKnowledgeBase();
                }
            });
        } else {
            console.warn('知识库按钮未找到');
        }
        
        if (closeKnowledgeBase && knowledgeBaseModal) {
            closeKnowledgeBase.addEventListener('click', () => {
                knowledgeBaseModal.classList.remove('show');
            });
        }
        
        if (closeKnowledgeBaseBtn && knowledgeBaseModal) {
            closeKnowledgeBaseBtn.addEventListener('click', () => {
                knowledgeBaseModal.classList.remove('show');
            });
        }
        
        if (knowledgeSearch) {
            knowledgeSearch.addEventListener('input', (e) => {
                this.searchKnowledgeBase(e.target.value);
            });
        }
        
        // 权限管理按钮
        const permissionsBtn = document.getElementById('permissionsBtn');
        const permissionsModal = document.getElementById('permissionsModal');
        const closePermissions = document.getElementById('closePermissions');
        const cancelPermissions = document.getElementById('cancelPermissions');
        const savePermissions = document.getElementById('savePermissions');
        const roleSelector = document.getElementById('roleSelector');
        
        if (permissionsBtn) {
            permissionsBtn.addEventListener('click', async () => {
                if (permissionsModal) {
                    permissionsModal.classList.add('show');
                    // 加载权限信息
                    await this.loadPermissions();
                }
            });
        } else {
            console.warn('权限管理按钮未找到');
        }
        
        if (closePermissions && permissionsModal) {
            closePermissions.addEventListener('click', () => {
                permissionsModal.classList.remove('show');
            });
        }
        
        if (cancelPermissions && permissionsModal) {
            cancelPermissions.addEventListener('click', () => {
                permissionsModal.classList.remove('show');
            });
        }
        
        if (savePermissions) {
            savePermissions.addEventListener('click', () => {
                this.savePermissions();
                if (permissionsModal) {
                    permissionsModal.classList.remove('show');
                }
            });
        }
        
        if (roleSelector) {
            roleSelector.addEventListener('change', (e) => {
                this.updatePermissionsDisplay(e.target.value);
            });
        }
        
        // 模态框背景点击关闭
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.remove('show');
                }
            });
        }
        
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.classList.remove('show');
                }
            });
        }
        
        if (knowledgeBaseModal) {
            knowledgeBaseModal.addEventListener('click', (e) => {
                if (e.target === knowledgeBaseModal) {
                    knowledgeBaseModal.classList.remove('show');
                }
            });
        }
        
        if (permissionsModal) {
            permissionsModal.addEventListener('click', (e) => {
                if (e.target === permissionsModal) {
                    permissionsModal.classList.remove('show');
                }
            });
        }
        
        // 历史记录相关按钮
        const saveHistoryBtn = document.getElementById('saveHistoryBtn');
        if (saveHistoryBtn) {
            saveHistoryBtn.addEventListener('click', () => {
                this.saveChatHistory();
            });
        } else {
            console.warn('保存历史记录按钮未找到');
        }
        
        // 标签页切换
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有活动状态
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                
                // 添加当前活动状态
                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab') + '-tab';
                const tabPane = document.getElementById(tabId);
                if (tabPane) {
                    tabPane.classList.add('active');
                }
            });
        });
        
        console.log('事件监听器设置完成');
    }

    // 键盘快捷键
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl + Enter 发送消息
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    this.sendChatMessage(messageInput.value);
                    messageInput.value = '';
                }
            }
            
            // Space 按住说话
            if (e.key === ' ' && !e.repeat) {
                e.preventDefault();
                this.startVoiceRecording();
            }
            
            // Esc 关闭模态框
            if (e.key === 'Escape') {
                const settingsModal = document.getElementById('settingsModal');
                const helpModal = document.getElementById('helpModal');
                const knowledgeBaseModal = document.getElementById('knowledgeBaseModal');
                const permissionsModal = document.getElementById('permissionsModal');
                if (settingsModal) settingsModal.classList.remove('show');
                if (helpModal) helpModal.classList.remove('show');
                if (knowledgeBaseModal) knowledgeBaseModal.classList.remove('show');
                if (permissionsModal) permissionsModal.classList.remove('show');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                this.stopVoiceRecording();
            }
        });
    }

    // 启动本地媒体流
    async startLocalStream() {
        try {
            console.log('请求访问摄像头和麦克风...');
            
            // 获取设备选择
            const audioDevice = document.getElementById('audioDevice')?.value;
            const videoDevice = document.getElementById('videoDevice')?.value;
            
            const constraints = {
                audio: audioDevice ? { deviceId: audioDevice } : true,
                video: videoDevice ? { deviceId: videoDevice } : { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                }
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('成功获取媒体流:', this.localStream);
            
            // 显示本地视频
            const localVideo = document.getElementById('localVideo');
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            if (localVideo && localVideoWrapper) {
                localVideo.srcObject = this.localStream;
                localVideoWrapper.style.display = 'block';
            }
            
            // 连接WebRTC
            await this.connectWebRTC();
        } catch (error) {
            console.error('获取媒体流失败:', error);
            this.showNotification('无法访问摄像头或麦克风: ' + error.message, 'error');
            throw error;
        }
    }

    // 停止本地媒体流
    async stopLocalStream() {
        try {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
                console.log('本地媒体流已停止');
            }
            
            // 隐藏本地视频
            const localVideoWrapper = document.getElementById('localVideoWrapper');
            if (localVideoWrapper) {
                localVideoWrapper.style.display = 'none';
            }
            
            // 断开WebRTC连接
            await this.disconnectWebRTC();
        } catch (error) {
            console.error('停止媒体流失败:', error);
        }
    }

    // 连接WebRTC
    async connectWebRTC() {
        try {
            console.log('开始WebRTC连接...');
            // 这里实现WebRTC连接逻辑
        } catch (error) {
            console.error('WebRTC连接失败:', error);
        }
    }

    // 断开WebRTC连接
    async disconnectWebRTC() {
        try {
            console.log('断开WebRTC连接...');
            // 这里实现WebRTC断开连接逻辑
        } catch (error) {
            console.error('断开WebRTC连接失败:', error);
        }
    }

    // 开始语音录制
    startVoiceRecording() {
        console.log('开始语音录制');
        this.isRecording = true;
        // 这里实现语音录制逻辑
    }

    // 停止语音录制
    stopVoiceRecording() {
        if (this.isRecording) {
            console.log('停止语音录制');
            this.isRecording = false;
            // 这里实现停止语音录制逻辑
        }
    }

    // 发送聊天消息
    async sendChatMessage(message) {
        if (!message.trim()) {
            this.showNotification('请输入消息内容', 'warning');
            return;
        }
        
        try {
            // 添加用户消息到聊天记录
            this.addMessageToChat('user', message, '我');
            
            // 如果没有sessionId，则先创建一个会话
            if (!this.sessionId) {
                await this.createSession();
            }
            
            // 发送到服务器
            if (this.socket && this.socket.connected) {
                this.socket.emit('chat_message', {
                    session_id: this.sessionId,
                    message: message
                });
            } else {
                this.showNotification('未连接到服务器', 'error');
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            this.showNotification('发送消息失败: ' + error.message, 'error');
        }
    }

    // 处理流式聊天响应
    handleChatStream(data) {
        // 实现流式显示AI回复
        const chatMessages = document.getElementById('chatMessages');
        let aiMessage = chatMessages.querySelector('.message-ai:last-child');
        
        if (!aiMessage) {
            // 创建新的AI消息
            aiMessage = document.createElement('div');
            aiMessage.className = 'message message-ai';
            aiMessage.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">AI助手</span>
                        <span class="message-time"></span>
                    </div>
                    <div class="message-text"></div>
                </div>
            `;
            chatMessages.appendChild(aiMessage);
        }
        
        const messageText = aiMessage.querySelector('.message-text');
        if (messageText && data.content) {
            messageText.textContent += data.content;
        }
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 处理流式聊天结束
    handleChatStreamEnd(data) {
        // 保存会话
        this.saveCurrentSession();
    }

    // 添加消息到聊天记录
    addMessageToChat(role, content, sender) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${role}`;
        
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${sender}</span>
                    <span class="message-time">${timeString}</span>
                </div>
                <div class="message-text">${this.escapeHtml(content)}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 添加到历史记录
        this.history.push({
            role: role,
            content: content,
            sender: sender,
            timestamp: now.toISOString()
        });
    }

    // 清空聊天历史
    clearChatHistory() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="welcome-content">
                        <h4>欢迎使用AI数字人助手</h4>
                        <p>我是您的智能助手，可以回答各种问题、提供帮助和建议。</p>
                        <p>点击"开始对话"按钮，让我们开始交流吧！</p>
                    </div>
                </div>
            `;
        }
        this.history = [];
        this.showNotification('聊天记录已清空', 'info');
    }

    // 切换全屏数字人
    toggleFullscreenAvatar() {
        const appContainer = document.querySelector('.app-container');
        const isFullscreen = appContainer.classList.contains('fullscreen-avatar');
        const toggleVideoViewBtn = document.getElementById('toggleVideoView');
        
        if (isFullscreen) {
            // 退出全屏
            appContainer.classList.remove('fullscreen-avatar');
            document.body.style.overflow = '';
            
            // 移除控制按钮
            const videoControls = document.querySelector('.video-controls');
            if (videoControls) {
                videoControls.remove();
            }
            
            // 更新按钮文本
            if (toggleVideoViewBtn) {
                toggleVideoViewBtn.innerHTML = '<i class="fas fa-expand"></i><span>全屏数字人</span>';
            }
            
            this.showNotification('退出全屏模式', 'info');
        } else {
            // 进入全屏
            appContainer.classList.add('fullscreen-avatar');
            document.body.style.overflow = 'hidden';
            
            // 添加控制按钮
            const videoWrapper = document.querySelector('.avatar-video-wrapper');
            if (videoWrapper) {
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'video-controls';
                controlsDiv.innerHTML = `
                    <button id="exitFullscreen" class="btn" title="退出全屏">
                        <i class="fas fa-compress"></i>
                    </button>
                    <button id="toggleFullscreenChat" class="btn" title="显示/隐藏聊天">
                        <i class="fas fa-comments"></i>
                    </button>
                `;
                videoWrapper.appendChild(controlsDiv);
                
                // 绑定事件
                const exitFullscreenBtn = document.getElementById('exitFullscreen');
                const toggleFullscreenChatBtn = document.getElementById('toggleFullscreenChat');
                
                if (exitFullscreenBtn) {
                    exitFullscreenBtn.addEventListener('click', () => {
                        this.toggleFullscreenAvatar();
                    });
                }
                
                if (toggleFullscreenChatBtn) {
                    toggleFullscreenChatBtn.addEventListener('click', () => {
                        const chatContainer = document.querySelector('.fullscreen-avatar .chat-section');
                        if (chatContainer) {
                            chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
                        }
                    });
                }
            }
            
            // 更新按钮文本
            if (toggleVideoViewBtn) {
                toggleVideoViewBtn.innerHTML = '<i class="fas fa-compress"></i><span>退出全屏</span>';
            }
            
            this.showNotification('进入全屏模式', 'info');
        }
    }

    // 切换聊天视图（收起/展开聊天框）
    toggleChatView() {
        const appContainer = document.querySelector('.app-container');
        const isChatHidden = appContainer.classList.contains('chat-hidden');
        const toggleChatViewBtn = document.getElementById('toggleChatView');
        
        if (isChatHidden) {
            // 展开聊天框
            appContainer.classList.remove('chat-hidden');
            if (toggleChatViewBtn) {
                toggleChatViewBtn.innerHTML = '<i class="fas fa-comments"></i><span>收起聊天</span>';
            }
            this.showNotification('聊天框已展开', 'info');
        } else {
            // 收起聊天框
            appContainer.classList.add('chat-hidden');
            if (toggleChatViewBtn) {
                toggleChatViewBtn.innerHTML = '<i class="fas fa-comments"></i><span>展开聊天</span>';
            }
            this.showNotification('聊天框已收起', 'info');
        }
    }

    // 上传文件
    async uploadFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(`文件上传成功: ${result.filename}`, 'success');
                // 在聊天中显示文件信息
                this.addMessageToChat('system', `已上传文件: ${result.filename}`, '文件上传');
            } else {
                this.showNotification(`文件上传失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            this.showNotification('文件上传失败', 'error');
        }
    }

    // 保存聊天历史
    async saveChatHistory() {
        try {
            const response = await fetch('/api/history/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    history: this.history
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.showNotification(`聊天历史已保存: ${result.filename}`, 'success');
            } else {
                this.showNotification(`保存聊天历史失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('保存聊天历史失败:', error);
            this.showNotification('保存聊天历史失败', 'error');
        }
    }

    // 加载历史记录列表
    async loadHistoryList() {
        try {
            const response = await fetch('/api/history/sessions');
            const result = await response.json();
            
            if (result.success) {
                this.displayHistoryList(result.sessions);
            } else {
                console.error('加载历史记录列表失败:', result.error);
                this.showNotification('加载历史记录列表失败', 'error');
            }
        } catch (error) {
            console.error('加载历史记录列表失败:', error);
            this.showNotification('加载历史记录列表失败', 'error');
        }
    }

    // 显示历史记录列表
    displayHistoryList(sessions) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        if (sessions.length === 0) {
            historyList.innerHTML = '<p>暂无历史记录</p>';
            return;
        }
        
        historyList.innerHTML = sessions.map(session => `
            <div class="history-item" data-session-id="${session.session_id}">
                <div class="history-item-header">
                    <span class="history-item-title">会话 ID: ${session.session_id.substring(0, 8)}...</span>
                    <span class="history-item-time">${new Date(session.created_at).toLocaleString()}</span>
                </div>
                <div class="history-item-content">
                    <span>消息数量: ${session.message_count}</span>
                    <div class="history-item-actions">
                        <button class="btn btn-small btn-primary load-history" data-session-id="${session.session_id}">加载</button>
                        <button class="btn btn-small btn-danger delete-history" data-session-id="${session.session_id}">删除</button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // 绑定事件
        historyList.querySelectorAll('.load-history').forEach(button => {
            button.addEventListener('click', (e) => {
                const sessionId = e.target.dataset.sessionId;
                this.loadHistorySession(sessionId);
            });
        });
        
        historyList.querySelectorAll('.delete-history').forEach(button => {
            button.addEventListener('click', (e) => {
                const sessionId = e.target.dataset.sessionId;
                this.deleteHistorySession(sessionId);
            });
        });
    }

    // 加载历史会话
    async loadHistorySession(sessionId) {
        try {
            const response = await fetch(`/api/history/load/${sessionId}`);
            const result = await response.json();
            
            if (result.success) {
                // 清空当前聊天
                this.clearChatHistory();
                
                // 加载历史消息
                result.history.forEach(msg => {
                    this.addMessageToChat(msg.role, msg.content, msg.sender);
                });
                
                this.showNotification('历史会话加载成功', 'success');
                // 关闭模态框
                document.getElementById('historyModal')?.classList.remove('show');
            } else {
                this.showNotification(`加载历史会话失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('加载历史会话失败:', error);
            this.showNotification('加载历史会话失败', 'error');
        }
    }

    // 删除历史会话
    async deleteHistorySession(sessionId) {
        try {
            const response = await fetch(`/api/history/delete/${sessionId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('历史会话删除成功', 'success');
                // 重新加载历史记录列表
                this.loadHistoryList();
            } else {
                this.showNotification(`删除历史会话失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('删除历史会话失败:', error);
            this.showNotification('删除历史会话失败', 'error');
        }
    }

    // 保存当前会话
    async saveCurrentSession() {
        if (this.history.length > 0 && this.sessionId) {
            try {
                const response = await fetch('/api/session/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        history: this.history
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    console.log('会话保存成功');
                } else {
                    console.error('会话保存失败:', result.error);
                }
            } catch (error) {
                console.error('保存会话失败:', error);
            }
        }
    }

    // 处理数字人动画
    handleAvatarAnimation(data) {
        // 验证数据有效性
        if (!data) {
            console.warn('无效的动画数据');
            return;
        }
        
        // 记录动画处理时间
        const processTime = Date.now();
        console.log(`开始处理数字人动画 - 时间戳: ${processTime}`, data);
        
        // 如果需要更新数字人状态显示
        if (data.expression) {
            this.updateAvatarStatus(data.expression);
        }
        
        // 如果有动画数据，播放相应动画效果
        if (data.animation) {
            this.playAvatarAnimation(data.animation);
        } else {
            // 如果没有动画数据，但有表情变化，也执行基础动画
            if (data.expression) {
                this.playBasicExpressionAnimation(data.expression, data.duration);
            }
        }
        
        // 触发其他可能的动画效果
        this.triggerAdditionalAnimations(data);
    }

    // 播放数字人动画
    playAvatarAnimation(animationData) {
        if (!animationData || typeof animationData !== 'object') {
            console.warn('无效的动画数据:', animationData);
            return;
        }
        
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarStatus = document.getElementById('avatarStatus');
        
        // 存储元素的原始样式
        const originalStyles = {
            filter: avatarVideo?.style.filter || '',
            transform: avatarVideo?.style.transform || '',
            color: avatarStatus?.style.color || ''
        };
        
        // 应用动画效果
        if (avatarVideo) {
            avatarVideo.style.filter = animationData.videoFilter || 'brightness(1.1) contrast(1.1)';
            avatarVideo.style.transform = animationData.videoTransform || 'scale(1.02)';
        }
        
        if (avatarStatus) {
            avatarStatus.textContent = animationData.statusText || '正在说话...';
            avatarStatus.style.color = animationData.statusColor || '#10b981';
        }
        
        // 计算持续时间（默认2秒）
        const duration = Math.max(
            1, 
            Math.min(10, animationData.duration || 2)
        );
        
        // 使用requestAnimationFrame确保动画平滑
        const start = performance.now();
        const animate = (time) => {
            const progress = Math.min((time - start) / (duration * 1000), 1);
            
            // 应用渐进式动画效果
            if (avatarVideo) {
                const scale = 1 + 0.02 * (1 - Math.pow(1 - progress, 2));
                avatarVideo.style.transform = `scale(${scale})`;
                
                const brightness = 1 + 0.1 * (1 - Math.pow(1 - progress, 2));
                avatarVideo.style.filter = `brightness(${brightness}) contrast(${brightness})`;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 动画结束时恢复原始样式
                if (avatarVideo) {
                    avatarVideo.style.filter = originalStyles.filter;
                    avatarVideo.style.transform = originalStyles.transform;
                }
                
                if (avatarStatus) {
                    avatarStatus.textContent = avatarStatus.getAttribute('data-original-text') || '准备就绪';
                    avatarStatus.style.color = originalStyles.color;
                }
            }
        };
        
        requestAnimationFrame(animate);
        
        console.log(`播放虚拟形象动画: ${animationData.name || 'default'}`, {
            ...animationData,
            calculatedDuration: duration
        });
    }
    
    // 播放基础表情动画
    playBasicExpressionAnimation(expression, duration = 2) {
        const avatarVideo = document.getElementById('avatarVideo');
        const avatarStatus = document.getElementById('avatarStatus');
        
        if (avatarVideo) {
            // 添加基础动画效果
            avatarVideo.style.transition = `all ${duration}s ease-in-out`;
            avatarVideo.style.transform = 'scale(1.02)';
            avatarVideo.style.filter = 'brightness(1.1) contrast(1.1)';
            
            // 设置定时器恢复原始状态
            setTimeout(() => {
                if (avatarVideo) {
                    avatarVideo.style.transform = '';
                    avatarVideo.style.filter = '';
                }
            }, duration * 1000);
        }
        
        if (avatarStatus) {
            // 保存原始文本和颜色
            const originalText = avatarStatus.getAttribute('data-original-text') || '准备就绪';
            const originalColor = avatarStatus.style.color;
            
            avatarStatus.textContent = `${expression}中...`;
            avatarStatus.style.color = '#10b981';
            
            // 设置定时器恢复原始状态
            setTimeout(() => {
                if (avatarStatus) {
                    avatarStatus.textContent = originalText;
                    avatarStatus.style.color = originalColor;
                }
            }, duration * 1000);
        }
    }
    
    // 触发其他可能的动画效果
    triggerAdditionalAnimations(data) {
        // 这里可以添加其他动画效果，如：
        // 1. 文字气泡显示
        // 2. 特效粒子效果
        // 3. 背景变化
        // 4. 其他UI反馈
        
        // 示例：如果数据中包含文本，可以触发文字气泡显示
        if (data.text) {
            this.showTextBubble(data.text);
        }
        
        // 示例：如果数据中包含特殊效果标记，可以触发特效
        if (data.effects && data.effects.includes('sparkle')) {
            this.triggerSparkleEffect();
        }
    }
    
    // 显示文字气泡
    showTextBubble(text) {
        const bubble = document.getElementById('textBubble');
        if (!bubble) return;
        
        bubble.textContent = text;
        bubble.style.display = 'block';
        bubble.style.opacity = '1';
        
        // 使用CSS动画实现淡出效果
        setTimeout(() => {
            bubble.style.opacity = '0';
        }, 3000);
        
        // 完全隐藏后重置样式
        setTimeout(() => {
            bubble.style.display = 'none';
        }, 3500);
    }
    
    // 触发光效
    triggerSparkleEffect() {
        const sparkleContainer = document.getElementById('sparkleContainer');
        if (!sparkleContainer) return;
        
        // 添加光效类
        sparkleContainer.classList.add('active');
        
        // 1秒后移除类，触发CSS动画
        setTimeout(() => {
            sparkleContainer.classList.remove('active');
        }, 1000);
    }

    // 播放TTS音频
    playTTS(base64Audio, format = 'wav') {
        try {
            if (!base64Audio) return;
            
            let blob;
            if (format === 'pcm') {
                // 处理PCM格式音频
                const binaryString = atob(base64Audio);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // 将PCM转换为WAV格式
                const wavBytes = this._pcmToWav(bytes, 24000); // 使用24kHz采样率
                blob = new Blob([wavBytes], {type: 'audio/wav'});
            } else {
                // 处理WAV格式音频
                blob = new Blob([this._base64ToArrayBuffer(base64Audio)], {type: 'audio/wav'});
            }
            
            // 创建音频播放对象
            const audio = new Audio(URL.createObjectURL(blob));
            
            // 添加加载错误处理
            audio.onerror = (e) => {
                console.error('音频加载失败:', e);
                this.showNotification('音频播放失败', 'error');
            };
            
            // 开始播放
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('播放TTS音频失败:', error);
                    this.showNotification('音频播放被浏览器阻止，请检查设置', 'error');
                    
                    // 尝试恢复播放
                    if (error.name === 'NotAllowedError') {
                        this.showNotification('需要用户交互才能播放音频', 'warning');
                        // 可以在这里添加用户交互提示
                    }
                });
            }
            
        } catch (error) {
            console.error('播放TTS音频失败:', error);
        }
    }

    // 将PCM数据转换为WAV格式
    _pcmToWav(pcmData, sampleRate = 24000) {
        const buffer = new ArrayBuffer(44 + pcmData.length);
        const view = new DataView(buffer);
        
        // WAV文件头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcmData.length, true);
        view.setUint32(8, 'WAVE'.length, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);  // fmt chunk size
        view.setUint16(20, 1, true);   // audio format (1 = PCM)
        view.setUint16(22, 1, true);   // number of channels
        view.setUint32(24, sampleRate, true);  // sample rate
        view.setUint32(28, sampleRate * 2, true);  // byte rate (sample rate * bits per sample * channels / 8)
        view.setUint16(32, 2, true);   // block align (bits per sample * channels / 8)
        view.setUint16(34, 16, true);  // bits per sample
        writeString(36, 'data');
        view.setUint32(40, pcmData.length, true);
        
        // 写入PCM数据
        for (let i = 0; i < pcmData.length; i++) {
            view.setUint8(44 + i, pcmData[i]);
        }
        
        return buffer;
    }

    // 将base64字符串转换为ArrayBuffer
    _base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // 获取TTS选项
    async getTtsOptions() {
        try {
            const response = await fetch('/api/tts/options');
            const result = await response.json();
            
            if (result.success) {
                return result.tts_options;
            } else {
                throw new Error(result.error || '获取TTS选项失败');
            }
        } catch (error) {
            console.error('获取TTS选项失败:', error);
            this.showNotification('获取TTS选项失败: ' + error.message, 'error');
            return [];
        }
    }

    // 切换TTS模块
    async switchTts(ttsName) {
        try {
            const response = await fetch('/api/tts/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tts_name: ttsName
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                return true;
            } else {
                throw new Error(result.error || '切换TTS失败');
            }
        } catch (error) {
            console.error('切换TTS失败:', error);
            this.showNotification('切换TTS失败: ' + error.message, 'error');
            return false;
        }
    }

    // 获取系统提示词选项
    async getSystemPrompts() {
        try {
            const response = await fetch('/api/system_prompts');
            const result = await response.json();
            
            if (result.success) {
                return result.system_prompts;
            } else {
                throw new Error(result.error || '获取系统提示词选项失败');
            }
        } catch (error) {
            console.error('获取系统提示词选项失败:', error);
            this.showNotification('获取系统提示词选项失败: ' + error.message, 'error');
            return [];
        }
    }

    // 获取LLM选项
    async getLlmOptions() {
        try {
            const response = await fetch('/api/llm/options');
            const result = await response.json();
            
            if (result.success) {
                return result.llm_options;
            } else {
                throw new Error(result.error || '获取LLM选项失败');
            }
        } catch (error) {
            console.error('获取LLM选项失败:', error);
            this.showNotification('获取LLM选项失败: ' + error.message, 'error');
            return [];
        }
    }

    // 切换LLM模型
    async switchLlm(modelName) {
        try {
            const response = await fetch('/api/llm/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_name: modelName
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                return true;
            } else {
                throw new Error(result.error || '切换LLM失败');
            }
        } catch (error) {
            console.error('切换LLM失败:', error);
            this.showNotification('切换LLM失败: ' + error.message, 'error');
            return false;
        }
    }

    // 设置系统提示词
    async setSystemPrompt(prompt, promptName = null) {
        try {
            const response = await fetch('/api/system_prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    prompt_name: promptName
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification(result.message, 'success');
                return true;
            } else {
                throw new Error(result.error || '设置系统提示词失败');
            }
        } catch (error) {
            console.error('设置系统提示词失败:', error);
            this.showNotification('设置系统提示词失败: ' + error.message, 'error');
            return false;
        }
    }

    // 获取历史会话列表
    async getHistorySessions() {
        try {
            const response = await fetch('/api/history/sessions');
            const result = await response.json();
            
            if (result.success) {
                return result.sessions;
            } else {
                throw new Error(result.error || '获取历史会话列表失败');
            }
        } catch (error) {
            console.error('获取历史会话列表失败:', error);
            this.showNotification('获取历史会话列表失败: ' + error.message, 'error');
            return [];
        }
    }

    // 显示权限管理模态框
    async showPermissionsModal() {
        const modal = document.getElementById('permissionsModal');
        if (!modal) {
            console.error('权限管理模态框未找到');
            this.showNotification('权限管理模态框未找到', 'error');
            return;
        }
        
        try {
            // 获取TTS选项
            const ttsOptions = await this.getTtsOptions();
            
            // 获取LLM选项
            const llmOptions = await this.getLlmOptions();
            
            // 获取系统提示词选项
            const systemPrompts = await this.getSystemPrompts();
            
            // 填充模态框内容
            const content = document.getElementById('permissionsContent');
            if (content) {
                content.innerHTML = `
                    <div class="permissions-section">
                        <h3>语音合成 (TTS) 设置</h3>
                        <div class="form-group">
                            <label>选择TTS引擎:</label>
                            <select id="ttsSelector">
                                ${ttsOptions.map(option => `
                                    <option value="${option.name}" ${option.name === "阿里云CosyVoice" ? 'selected' : ''}>${option.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="permissions-section">
                        <h3>大语言模型 (LLM) 设置</h3>
                        <div class="form-group">
                            <label>选择LLM模型:</label>
                            <select id="llmSelector">
                                ${llmOptions.map(option => `
                                    <option value="${option.model_name}" ${option.default ? 'selected' : ''}>${option.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="permissions-section">
                        <h3>角色设定</h3>
                        <div class="form-group">
                            <label>选择预设角色:</label>
                            <select id="systemPromptSelector">
                                ${systemPrompts.map(prompt => `
                                    <option value="${prompt.name}" ${prompt.default ? 'selected' : ''}>${prompt.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="customPrompt">自定义角色设定:</label>
                            <textarea id="customPrompt" placeholder="输入自定义角色设定..."></textarea>
                        </div>
                        <button id="applyCustomPrompt" class="btn btn-primary">应用自定义设定</button>
                    </div>
                    
                    <div class="permissions-actions">
                        <button id="applyPermissions" class="btn btn-primary">应用设置</button>
                        <button id="resetPermissions" class="btn btn-secondary">重置默认设置</button>
                    </div>
                `;
                
                // 绑定事件
                document.getElementById('applyPermissions')?.addEventListener('click', async () => {
                    const ttsSelector = document.getElementById('ttsSelector');
                    const llmSelector = document.getElementById('llmSelector');
                    const systemPromptSelector = document.getElementById('systemPromptSelector');
                    
                    if (ttsSelector) {
                        await this.switchTts(ttsSelector.value);
                    }
                    
                    if (llmSelector) {
                        await this.switchLlm(llmSelector.value);
                    }
                    
                    if (systemPromptSelector) {
                        const selectedPrompt = systemPrompts.find(p => p.name === systemPromptSelector.value);
                        if (selectedPrompt) {
                            await this.setSystemPrompt(selectedPrompt.prompt, selectedPrompt.name);
                        }
                    }
                });
                
                document.getElementById('applyCustomPrompt')?.addEventListener('click', async () => {
                    const customPrompt = document.getElementById('customPrompt');
                    if (customPrompt && customPrompt.value.trim()) {
                        await this.setSystemPrompt(customPrompt.value, '自定义角色');
                    }
                });
                
                document.getElementById('resetPermissions')?.addEventListener('click', () => {
                    // 重置为默认设置
                    const ttsSelector = document.getElementById('ttsSelector');
                    const llmSelector = document.getElementById('llmSelector');
                    const systemPromptSelector = document.getElementById('systemPromptSelector');
                    
                    if (ttsSelector) {
                        ttsSelector.value = ttsOptions.find(o => o.name === '阿里云CosyVoice')?.name || ttsOptions[0]?.name || '';
                    }
                    
                    if (llmSelector) {
                        llmSelector.value = llmOptions.find(o => o.default)?.model_name || llmOptions[0]?.model_name || '';
                    }
                    
                    if (systemPromptSelector) {
                        systemPromptSelector.value = systemPrompts.find(p => p.default)?.name || systemPrompts[0]?.name || '';
                    }
                });
            }
            
            // 显示模态框
            modal.classList.add('show');
        } catch (error) {
            console.error('显示权限管理模态框失败:', error);
            this.showNotification('显示权限管理模态框失败: ' + error.message, 'error');
        }
    }

    // 加载知识库
    async loadKnowledgeBase() {
        try {
            const response = await fetch('/api/knowledge_base/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: ''
                })
            });
            
            const result = await response.json();
            if (result.success) {
                // 显示知识库内容
                this.showKnowledgeBase(result.topics);
            } else {
                throw new Error(result.error || '加载知识库失败');
            }
        } catch (error) {
            console.error('加载知识库失败:', error);
            this.showNotification('加载知识库失败: ' + error.message, 'error');
        }
    }

    // 显示知识库
    showKnowledgeBase(topics) {
        const modal = document.getElementById('knowledgeBaseModal');
        const content = document.getElementById('knowledgeBaseContent');
        
        if (modal && content) {
            // 填充知识库内容
            content.innerHTML = topics.map(topic => `
                <div class="knowledge-item">
                    <h4>${this.escapeHtml(topic.title)}</h4>
                    <p>${this.escapeHtml(topic.content)}</p>
                    <div class="knowledge-tags">
                        ${(topic.tags || []).map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
            `).join('');
            
            // 显示模态框
            modal.classList.add('show');
        }
    }

    // 搜索知识库
    async searchKnowledgeBase(query) {
        if (!query.trim()) {
            // 如果查询为空，重新加载所有主题
            await this.loadKnowledgeBase();
            return;
        }
        
        try {
            const response = await fetch('/api/knowledge_base/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: query })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayKnowledgeBase(result.results);
            } else {
                console.error('搜索知识库失败:', result.error);
            }
        } catch (error) {
            console.error('搜索知识库失败:', error);
        }
    }

    // 显示知识详情
    showKnowledgeDetail(topic) {
        // 在实际应用中，这里可以显示详细的知识内容
        this.showNotification(`查看知识: ${topic.title}`, 'info');
    }

    // 加载权限信息
    async loadPermissions() {
        try {
            // 更新当前用户角色显示
            const currentUserRole = document.getElementById('currentUserRole');
            if (currentUserRole) {
                currentUserRole.textContent = this.currentUserRole;
            }
            
            // 更新角色选择器
            const roleSelector = document.getElementById('roleSelector');
            if (roleSelector) {
                roleSelector.value = this.currentUserRole;
            }
            
            // 更新权限显示
            this.updatePermissionsDisplay(this.currentUserRole);
        } catch (error) {
            console.error('加载权限信息失败:', error);
        }
    }

    // 更新权限显示
    updatePermissionsDisplay(role) {
        const userPermissions = document.getElementById('userPermissions');
        if (!userPermissions) return;
        
        // 模拟权限数据
        const permissions = {
            'admin': ['read', 'write', 'delete', 'manage_users', 'access_knowledge_base'],
            'user': ['read', 'write'],
            'guest': ['read']
        };
        
        const rolePermissions = permissions[role] || [];
        
        userPermissions.innerHTML = '';
        rolePermissions.forEach(permission => {
            const permissionItem = document.createElement('div');
            permissionItem.className = 'permission-item';
            permissionItem.innerHTML = `
                <input type="checkbox" id="perm_${permission}" value="${permission}" checked disabled>
                <label for="perm_${permission}">${permission}</label>
            `;
            userPermissions.appendChild(permissionItem);
        });
    }

    // 保存权限设置
    savePermissions() {
        const roleSelector = document.getElementById('roleSelector');
        if (roleSelector) {
            this.currentUserRole = roleSelector.value;
            this.showNotification(`权限角色已更新为: ${this.currentUserRole}`, 'success');
        }
    }

    // 设置管理
    saveSettings() {
        const audioDevice = document.getElementById('audioDevice');
        const videoDevice = document.getElementById('videoDevice');
        const avatarType = document.getElementById('avatarType');
        const avatarModel = document.getElementById('avatarModel');
        const aiModel = document.getElementById('aiModel');
        
        const settings = {
            audioDevice: audioDevice?.value,
            videoDevice: videoDevice?.value,
            avatarType: avatarType?.value,
            avatarModel: avatarModel?.value,
            aiModel: aiModel?.value
        };
        
        localStorage.setItem('avatarChatSettings', JSON.stringify(settings));
        this.showNotification('设置已保存', 'success');
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // 添加到通知容器
        const notificationContainer = document.getElementById('notificationContainer') || document.createElement('div');
        if (!document.getElementById('notificationContainer')) {
            notificationContainer.id = 'notificationContainer';
            document.body.appendChild(notificationContainer);
        }
        
        notificationContainer.appendChild(notification);
        
        // 绑定关闭事件
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.remove();
            }
        });
        
        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // 显示加载动画
    showLoading(show) {
        let loadingElement = document.getElementById('globalLoading');
        
        if (show) {
            if (!loadingElement) {
                loadingElement = document.createElement('div');
                loadingElement.id = 'globalLoading';
                loadingElement.className = 'loading show';
                loadingElement.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <span>加载中...</span>
                    </div>
                `;
                document.body.appendChild(loadingElement);
            } else {
                loadingElement.classList.add('show');
            }
        } else {
            if (loadingElement) {
                loadingElement.classList.remove('show');
            }
        }
    }

    // 显示按钮反馈
    showButtonFeedback(button, message, type = 'info') {
        // 这里可以实现按钮反馈效果
        this.showNotification(message, type);
    }

    // ArrayBuffer转Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 确保在页面完全加载后再初始化
    window.app = new AvatarChatApp();
    
    // 防止页面过度滚动
    document.body.addEventListener('touchmove', function(e) {
        if (e.scale !== 1) {
            e.preventDefault();
        }
    }, { passive: false });
});