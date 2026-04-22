// AI数字人教学助手 v2.0
class TeachingAppV2 {
    constructor() {
        this.currentPanel = 'chat';
        this.init();
    }

    init() {
        this.initLucideIcons();
        this.setupEventListeners();
        this.loadTheme();
    }

    initLucideIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setupEventListeners() {
        // 侧边栏导航
        document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.currentTarget.getAttribute('data-panel');
                this.switchPanel(panel);
            });
        });

        // 设置按钮
        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('cancel-settings')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings')?.addEventListener('click', () => this.saveSettings());

        // 教案生成
        document.getElementById('generate-lesson-btn')?.addEventListener('click', () => this.generateLesson());

        // 聊天
        document.getElementById('send-btn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 视频控制
        document.getElementById('mic-toggle')?.addEventListener('click', () => this.toggleMic());
        document.getElementById('camera-toggle')?.addEventListener('click', () => this.toggleCamera());
        document.getElementById('call-toggle')?.addEventListener('click', () => this.toggleCall());

        // 点击弹窗外部关闭
        document.getElementById('settings-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') this.closeSettings();
        });

        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSettings();
        });
    }

    switchPanel(panelName) {
        document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-panel') === panelName) btn.classList.add('active');
        });

        document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
        const targetPanel = document.getElementById(`panel-${panelName}`);
        if (targetPanel) targetPanel.classList.add('active');

        const titles = {
            chat: { title: '智能对话', subtitle: '与数字人教师实时交流' },
            memory: { title: '记忆系统', subtitle: '学生学习画像与历史记录' },
            knowledge: { title: '知识图谱', subtitle: '知识点关系与掌握状态' },
            lesson: { title: '教案生成', subtitle: 'AI辅助生成教学方案' },
            evaluation: { title: '学习评价', subtitle: '成绩分析与进度追踪' }
        };

        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');
        if (titleEl && subtitleEl && titles[panelName]) {
            titleEl.textContent = titles[panelName].title;
            subtitleEl.textContent = titles[panelName].subtitle;
        }

        this.currentPanel = panelName;
        this.initLucideIcons();
    }

    openSettings() {
        document.getElementById('settings-modal')?.classList.add('active');
    }

    closeSettings() {
        document.getElementById('settings-modal')?.classList.remove('active');
    }

    saveSettings() {
        const theme = document.getElementById('theme-select')?.value;
        if (theme) {
            localStorage.setItem('theme', theme);
            this.loadTheme();
        }
        alert('设置已保存');
        this.closeSettings();
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) themeSelect.value = theme;
    }

    generateLesson() {
        const result = document.getElementById('lesson-result');
        if (result) {
            result.style.display = 'block';
            alert('教案生成成功');
        }
    }

    sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        this.addMessage('user', message);
        input.value = '';

        setTimeout(() => {
            this.addMessage('ai', '这是一个模拟回复。在实际应用中，这里会连接AI模型生成真实回复。');
        }, 1000);
    }

    addMessage(type, content) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `<div class="message-content">${content}</div><div class="message-time">${new Date().toLocaleTimeString()}</div>`;
        messages.appendChild(messageEl);
        messages.scrollTop = messages.scrollHeight;
    }

    toggleMic() {
        const btn = document.getElementById('mic-toggle');
        if (btn) {
            btn.classList.toggle('active');
            alert(btn.classList.contains('active') ? '麦克风已开启' : '麦克风已关闭');
        }
    }

    toggleCamera() {
        const btn = document.getElementById('camera-toggle');
        if (btn) {
            btn.classList.toggle('active');
            alert(btn.classList.contains('active') ? '摄像头已开启' : '摄像头已关闭');
        }
    }

    toggleCall() {
        const btn = document.getElementById('call-toggle');
        if (btn) {
            btn.classList.toggle('active');
            alert(btn.classList.contains('active') ? '通话已开始' : '通话已结束');
        }
    }
}

// 添加消息样式
const style = document.createElement('style');
style.textContent = `
    .message { padding: 12px 16px; border-radius: 12px; max-width: 80%; margin-bottom: 12px; animation: slideIn 0.3s ease; }
    .message-user { background: var(--primary); color: white; margin-left: auto; }
    .message-ai { background: var(--bg-tertiary); color: var(--text-primary); margin-right: auto; }
    .message-content { font-size: 14px; line-height: 1.5; margin-bottom: 4px; }
    .message-time { font-size: 11px; opacity: 0.7; text-align: right; }
    @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .control-btn.active { background: var(--primary); color: white; }
`;
document.head.appendChild(style);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.teachingAppV2 = new TeachingAppV2();
});
