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
        this.currentPath = window.location.pathname;
        this.init();
    }

    init() {
        // 监听浏览器前进后退
        window.addEventListener('popstate', () => {
            this.currentPath = window.location.pathname;
            this.handleRoute();
        });

        // 初始路由
        this.handleRoute();
    }

    navigate(path) {
        if (this.currentPath !== path) {
            this.currentPath = path;
            window.history.pushState({}, '', path);
            this.handleRoute();
        }
    }

    handleRoute() {
        const path = this.currentPath;
        const route = this.routes[path] || this.routes['/'];
        route();
    }

    loadVideoChat() {
        const app = document.getElementById('app');
        app.innerHTML = '<iframe src="videochat.html" style="width:100%;height:100vh;border:none;"></iframe>';
    }

    loadConsole(module) {
        const app = document.getElementById('app');
        app.innerHTML = `<iframe src="console.html?module=${module}" style="width:100%;height:100vh;border:none;"></iframe>`;
    }
}

// 初始化路由
document.addEventListener('DOMContentLoaded', () => {
    window.router = new Router();
});

