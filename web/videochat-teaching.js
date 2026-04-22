// AI数字人教学助手 - 前端逻辑
class TeachingApp {
    constructor() {
        this.currentPanel = 'chat';
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    async init() {
        this.initLucideIcons();
        this.setupEventListeners();
        this.loadTheme();
        this.showToast('系统初始化完成', 'success');
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

        // 主题切换
        document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

        // 控制台按钮
        document.getElementById('console-btn')?.addEventListener('click', () => {
            window.location.href = '/ui/console.html';
        });

        // 教案生成
        document.getElementById('generate-lesson-btn')?.addEventListener('click', () => this.generateLesson());

        // 聊天功能
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
            if (e.target.id === 'settings-modal') {
                this.closeSettings();
            }
        });

        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        });
    }

    // 切换面板
    switchPanel(panelName) {
        // 更新侧边栏状态
        document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-panel') === panelName) {
                btn.classList.add('active');
            }
        });

        // 更新面板显示
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`panel-${panelName}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        // 更新标题
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

    // 设置弹窗
    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    saveSettings() {
        const theme = document.getElementById('theme-select')?.value;
        if (theme) {
            localStorage.setItem('theme', theme);
            this.loadTheme();
        }
        this.showToast('设置已保存', 'success');
        this.closeSettings();
    }

    // 主题管理
    loadTheme() {
        const theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }

        const themeIcon = document.querySelector('#theme-toggle-btn svg');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
            this.initLucideIcons();
        }
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        this.loadTheme();
        this.showToast(`已切换到${next === 'dark' ? '深色' : '浅色'}主题`, 'info');
    }

    // 教案生成
    generateLesson() {
        this.showToast('正在生成教案...', 'info');
        
        setTimeout(() => {
            const result = document.getElementById('lesson-result');
            if (result) {
                result.style.display = 'block';
                this.showToast('教案生成成功', 'success');
            }
        }, 1500);
    }

    // 聊天功能
    sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const message = input.value.trim();
        this.addMessage('user', message);
        input.value = '';

        // 模拟AI回复
        setTimeout(() => {
            this.addMessage('ai', '这是一个模拟回复。在实际应用中，这里会连接AI模型生成真实回复。');
        }, 1000);
    }

    addMessage(type, content) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        messages.appendChild(messageEl);
        messages.scrollTop = messages.scrollHeight;
    }

    // 视频控制
    toggleMic() {
        const btn = document.getElementById('mic-toggle');
        if (btn) {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            this.showToast(isActive ? '麦克风已开启' : '麦克风已关闭', 'info');
        }
    }

    toggleCamera() {
        const btn = document.getElementById('camera-toggle');
        if (btn) {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            this.showToast(isActive ? '摄像头已开启' : '摄像头已关闭', 'info');
        }
    }

    toggleCall() {
        const btn = document.getElementById('call-toggle');
        if (btn) {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            this.showToast(isActive ? '通话已开始' : '通话已结束', isActive ? 'success' : 'warning');
        }
    }

    // 通知系统
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// 添加消息样式
const style = document.createElement('style');
style.textContent = `
    .message {
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        max-width: 80%;
        margin-bottom: var(--space-3);
        animation: slideIn 0.3s ease;
    }
    .message-user {
        background: var(--primary);
        color: white;
        margin-left: auto;
        box-shadow: var(--shadow-glow-primary);
    }
    .message-ai {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        margin-right: auto;
        box-shadow: var(--shadow-border);
    }
    .message-content {
        font-size: 0.875rem;
        line-height: 1.5;
        margin-bottom: var(--space-1);
    }
    .message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        text-align: right;
    }
    .control-btn.active {
        background: var(--primary);
        color: white;
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.teachingApp = new TeachingApp();
});
