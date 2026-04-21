// 全局状态管理对象，替代Pinia store
class StateManager {
    constructor() {
        this.state = {
            // 视频聊天状态
            devices: [],
            availableVideoDevices: [],
            availableAudioDevices: [],
            selectedVideoDevice: null,
            selectedAudioDevice: null,
            streamState: 'closed', // closed, connecting, open
            stream: null,
            peerConnection: null,
            localStream: null,
            webRTCId: '',
            webcamAccessed: false,
            avatarType: '',
            avatarWSRoute: '',
            avatarAssetsPath: '',
            rtcConfig: undefined,
            trackConstraints: {
                video: { width: 500, height: 500 },
                audio: true,
            },
            gsLoadPercent: 0,
            volumeMuted: false,
            micMuted: false,
            cameraOff: false,
            hasCamera: false,
            hasCameraPermission: true,
            hasMic: false,
            hasMicPermission: true,
            showChatRecords: false,
            localAvatarRenderer: null,
            chatDataChannel: null,
            replying: false,
            chatRecords: [],

            // 控制台状态
            currentUser: null,
            permissions: [],
            selectedMenuKey: 'dashboard',
            sidebarCollapsed: false,
            theme: 'light', // light or dark
            loading: false,
            error: null,

            // 视觉状态
            wrapperRef: null,
            wrapperRect: { width: 0, height: 0 },
            isLandscape: false,
            remoteVideoContainerRef: null,
            localVideoContainerRef: null,
            localVideoRef: null,
            remoteVideoRef: null,
        };

        this.listeners = new Map();
        this.init();
    }

    init() {
        // 初始化主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.state.theme = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);

        // 初始化配置
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch('/openavatarchat/initconfig');
            const config = await response.json();
            
            if (config.rtc_configuration) {
                this.state.rtcConfig = config.rtc_configuration;
            }
            if (config.avatar_config) {
                this.state.avatarType = config.avatar_config.avatar_type || '';
                this.state.avatarWSRoute = config.avatar_config.avatar_ws_route || '';
                this.state.avatarAssetsPath = config.avatar_config.avatar_assets_path || '';
            }
            if (config.track_constraints) {
                this.state.trackConstraints = config.track_constraints;
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    // 获取状态
    getState(key) {
        return key ? this.state[key] : this.state;
    }

    // 设置状态
    setState(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.notify(key, value, oldValue);
    }

    // 更新多个状态
    updateState(updates) {
        Object.keys(updates).forEach(key => {
            const oldValue = this.state[key];
            this.state[key] = updates[key];
            this.notify(key, updates[key], oldValue);
        });
    }

    // 订阅状态变化
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);

        // 返回取消订阅函数
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    // 通知监听器
    notify(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue, this.state);
                } catch (error) {
                    console.error('状态监听器错误:', error);
                }
            });
        }

        // 触发全局事件
        window.dispatchEvent(new CustomEvent('statechange', {
            detail: { key, newValue, oldValue, state: this.state }
        }));
    }

    // 主题切换
    toggleTheme() {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.setState('theme', newTheme);
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }
}

// 创建全局状态管理器
window.stateManager = new StateManager();

