// 路由管理系统
class Router {
    constructor() {
        this.routes = {
            '/': () => this.navigate('/videochat'),
            '/videochat': () => this.loadVideoChat(),
            '/console': () => this.loadConsole('dashboard'),
            '/console/dashboard': () => this.loadConsole('dashboard'),
            '/console/permissions': () => this.loadConsole('permissions'),
            '/console/avatars': () => this.loadConsole('avatars'),
            '/console/knowledge': () => this.loadConsole('knowledge'),
            '/console/analytics': () => this.loadConsole('analytics'),
            '/console/templates': () => this.loadConsole('templates'),
        };
        this.currentPath = this.getPath();
        this.init();
    }

    getPath() {
        // 处理 /ui/ 前缀
        let path = window.location.pathname;
        if (path.startsWith('/ui/')) {
            path = path.substring(4);
        }
        if (path === '' || path === '/') {
            return '/videochat';
        }
        return path;
    }

    init() {
        // 监听浏览器前进后退
        window.addEventListener('popstate', () => {
            this.currentPath = this.getPath();
            this.handleRoute();
        });

        // 初始路由
        this.handleRoute();
    }

    navigate(path) {
        const fullPath = path.startsWith('/ui/') ? path : `/ui${path}`;
        if (this.currentPath !== path) {
            this.currentPath = path;
            window.history.pushState({}, '', fullPath);
            this.handleRoute();
        }
    }

    handleRoute() {
        const path = this.currentPath;
        const route = this.routes[path] || this.routes['/'];
        if (route) {
            route();
        } else {
            // 未匹配的路由，重定向到视频聊天
            this.navigate('/videochat');
        }
    }

    loadVideoChat() {
        // 直接跳转到 videochat.html，而不是使用 iframe
        window.location.href = '/ui/videochat.html';
    }

    loadConsole(module) {
        const app = document.getElementById('app');
        app.innerHTML = `<iframe src="/ui/console.html?module=${module}" style="width:100%;height:100vh;border:none;"></iframe>`;
    }
}

// 全局路由对象
window.router = null;

// 初始化路由
document.addEventListener('DOMContentLoaded', () => {
    window.router = new Router();
});
