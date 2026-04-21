// 控制台主逻辑
class ConsoleManager {
  constructor() {
    this.currentModule = 'dashboard';
    this.collapsed = false;
    this.theme = localStorage.getItem('theme') || 'light';
    this.modules = {
      dashboard: () => this.loadModule('console-dashboard.html'),
      permissions: () => this.loadModule('console-permissions.html'),
      avatars: () => this.loadModule('console-avatars.html'),
      knowledge: () => this.loadModule('console-knowledge.html'),
      analytics: () => this.loadModule('console-analytics.html'),
      templates: () => this.loadModule('console-templates.html'),
    };
    this.init();
  }

  init() {
    // 从URL获取当前模块
    const urlParams = new URLSearchParams(window.location.search);
    const module = urlParams.get('module') || 'dashboard';
    this.currentModule = module;

    // 初始化UI
    this.initSidebar();
    this.initHeader();
    this.initMenu();
    this.applyTheme();
    this.loadModule();
    
    // 初始化Lucide图标
    this.initLucideIcons();
  }

  initLucideIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  initSidebar() {
    const sidebar = document.getElementById('console-sider');
    const toggleBtn = document.getElementById('sidebar-toggle');
    
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }
  }

  toggleSidebar() {
    this.collapsed = !this.collapsed;
    const sidebar = document.getElementById('console-sider');
    const main = document.querySelector('.console-main');
    
    if (sidebar) {
      sidebar.classList.toggle('collapsed', this.collapsed);
    }
    
    // 更新logo显示
    const logoFull = document.getElementById('logo-full');
    const logoCollapsed = document.getElementById('logo-collapsed');
    
    if (this.collapsed) {
      if (logoFull) logoFull.style.display = 'none';
      if (logoCollapsed) logoCollapsed.style.display = 'block';
    } else {
      if (logoFull) logoFull.style.display = 'block';
      if (logoCollapsed) logoCollapsed.style.display = 'none';
    }
  }

  initHeader() {
    // 返回按钮
    const backBtn = document.getElementById('back-to-videochat');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/ui/videochat.html';
      });
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    const userInfoBtn = document.getElementById('user-info-btn');
    const userMenu = document.getElementById('user-menu');
    
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
    
    if (userInfoBtn && userMenu) {
      userInfoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = userMenu.style.display === 'block';
        userInfoBtn.closest('.user-dropdown').classList.toggle('active', !isActive);
        userMenu.style.display = isActive ? 'none' : 'block';
      });
      
      // 点击外部关闭菜单
      document.addEventListener('click', (e) => {
        if (!userInfoBtn.contains(e.target) && !userMenu.contains(e.target)) {
          userMenu.style.display = 'none';
          userInfoBtn.closest('.user-dropdown').classList.remove('active');
        }
      });
      
      // 处理用户菜单项点击
      userMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          const action = item.getAttribute('data-action');
          this.handleUserAction(action);
          userMenu.style.display = 'none';
        });
      });
    }
  }

  initMenu() {
    const menuItems = document.querySelectorAll('.console-menu .menu-item');
    
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const key = item.getAttribute('data-key');
        if (key) {
          this.switchModule(key);
        }
      });
    });
    
    // 设置当前激活的菜单项
    this.updateActiveMenu();
  }

  updateActiveMenu() {
    const menuItems = document.querySelectorAll('.console-menu .menu-item');
    menuItems.forEach(item => {
      const key = item.getAttribute('data-key');
      if (key === this.currentModule) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  switchModule(moduleKey) {
    if (this.modules[moduleKey]) {
      console.log(`切换到模块: ${moduleKey}`);
      
      // 为仪表盘添加特殊响应
      if (moduleKey === 'dashboard') {
        this.handleDashboardClick();
      }
      
      this.currentModule = moduleKey;
      this.updateActiveMenu();
      this.loadModule();
      
      // 更新URL
      const newUrl = `${window.location.pathname}?module=${moduleKey}`;
      window.history.pushState({ module: moduleKey }, '', newUrl);
    }
  }

  // 仪表盘按钮的响应处理
  handleDashboardClick() {
    console.log('✅ 仪表盘模块已激活');
    
    // 等待模块加载完成后刷新数据
    setTimeout(() => {
      if (window.dashboardModule) {
        console.log('🔄 刷新仪表盘数据...');
        window.dashboardModule.loadStats();
        this.showNotification('仪表盘数据已刷新', 'success');
      }
    }, 500);
  }

  // 简单的通知提示（临时实现）
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `console-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 24px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#52c41a' : '#1890ff'};
      color: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  loadModule(moduleFile) {
    const contentWrapper = document.getElementById('content-wrapper');
    if (!contentWrapper) return;
    
    // 显示加载状态
    contentWrapper.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    `;
    
    // 根据模块名加载对应的HTML文件
    const moduleName = moduleFile || `console-${this.currentModule}.html`;
    const modulePath = moduleName;
    
    // 动态加载模块内容
    fetch(modulePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`无法加载模块: ${modulePath}`);
        }
        return response.text();
      })
      .then(html => {
        // 创建临时容器解析HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // 提取body内容或整个HTML
        const content = temp.querySelector('.module-content') || temp.querySelector('body') || temp;
        
        // 如果找到 .module-content，保留其类名
        if (content && content.classList) {
          // 将类名添加到 contentWrapper
          contentWrapper.className = content.className;
          contentWrapper.innerHTML = content.innerHTML;
        } else {
          contentWrapper.innerHTML = content.innerHTML;
        }
        
        console.log('📦 模块内容已插入，contentWrapper类名:', contentWrapper.className);
        console.log('📦 查找.dashboard元素:', document.querySelector('.dashboard'));
        
        // 初始化Lucide图标
        this.initLucideIcons();
        
        // 加载对应的JS和CSS文件
        const baseName = this.currentModule;
        this.loadModuleScript(baseName);
        this.loadModuleStyle(baseName);
        
        // 模块加载完成后的回调 - 立即检查
        const initModule = () => {
          console.log('🔄 模块加载完成，初始化模块:', this.currentModule);
          
          if (this.currentModule === 'dashboard') {
            const dashboardEl = contentWrapper.querySelector('.dashboard') || document.querySelector('.dashboard');
            console.log('🔍 查找dashboard元素:', {
              '在contentWrapper中': !!contentWrapper.querySelector('.dashboard'),
              '在document中': !!document.querySelector('.dashboard'),
              'contentWrapper类名': contentWrapper.className
            });
            
            if (!window.dashboardModule && dashboardEl) {
              if (window.DashboardModule) {
                window.dashboardModule = new window.DashboardModule();
                console.log('✅ 创建了新的Dashboard模块实例');
                window.dashboardModule.loadStats();
              } else {
                console.error('❌ DashboardModule类不存在');
              }
            } else if (window.dashboardModule) {
              console.log('🔄 调用loadStats...');
              window.dashboardModule.loadStats();
            }
          } else if (this.currentModule === 'permissions') {
            const permissionEl = contentWrapper.querySelector('.permission-management') || 
                                document.querySelector('.permission-management');
            console.log('🔍 查找permission元素:', {
              '在contentWrapper中': !!contentWrapper.querySelector('.permission-management'),
              '在document中': !!document.querySelector('.permission-management'),
              'contentWrapper类名': contentWrapper.className
            });
            
            if (permissionEl) {
              // 如果模块已存在，先销毁（因为DOM已重新创建，需要重新绑定事件）
              if (window.permissionsModule) {
                console.log('🔄 销毁旧的权限管理模块实例（DOM已重新创建）');
                // 清理旧的事件监听器（通过重新绑定来覆盖）
                window.permissionsModule = null;
              }
              
              // 创建新的模块实例（会重新绑定事件）
              if (window.PermissionsModule) {
                window.permissionsModule = new window.PermissionsModule();
                console.log('✅ 创建了新的权限管理模块实例');
              } else {
                console.error('❌ PermissionsModule类不存在');
              }
            }
          } else if (this.currentModule === 'avatars') {
            const avatarEl = contentWrapper.querySelector('.avatar-management') || 
                            document.querySelector('.avatar-management');
            console.log('🔍 查找avatar元素:', {
              '在contentWrapper中': !!contentWrapper.querySelector('.avatar-management'),
              '在document中': !!document.querySelector('.avatar-management'),
              'contentWrapper类名': contentWrapper.className
            });
            
            if (avatarEl) {
              // 如果模块已存在，先销毁
              if (window.avatarsModule) {
                console.log('🔄 销毁旧的数字人管理模块实例（DOM已重新创建）');
                window.avatarsModule = null;
              }
              
              // 创建新的模块实例
              if (window.AvatarsModule) {
                window.avatarsModule = new window.AvatarsModule();
                console.log('✅ 创建了新的数字人管理模块实例');
              } else {
                console.error('❌ AvatarsModule类不存在');
              }
            }
          }
        };
        
        // 立即尝试初始化
        setTimeout(initModule, 100);
        // 延迟再次尝试（等待脚本加载）
        setTimeout(initModule, 500);
        setTimeout(initModule, 1000);
      })
      .catch(error => {
        console.error('加载模块失败:', error);
        contentWrapper.innerHTML = `
          <div class="error-container" style="text-align: center; padding: 40px;">
            <h2>加载失败</h2>
            <p>${error.message}</p>
            <p style="color: #999; margin-top: 20px;">模块文件 ${modulePath} 尚未创建</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 8px 16px; background: #7873f6; color: white; border: none; border-radius: 4px; cursor: pointer;">重新加载</button>
          </div>
        `;
      });
  }
  
  loadModuleStyle(moduleName) {
    const styleName = `console-${moduleName}.css`;
    const existingLink = document.querySelector(`link[data-module="${styleName}"]`);
    
    if (existingLink) {
      return; // 样式已加载
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleName;
    link.setAttribute('data-module', styleName);
    link.onerror = () => {
      console.warn(`模块样式 ${styleName} 未找到，可能不需要`);
    };
    document.head.appendChild(link);
  }

  loadModuleScript(moduleName) {
    const scriptName = `console-${moduleName.replace('.html', '')}.js`;
    const existingScript = document.querySelector(`script[data-module="${scriptName}"]`);
    
    // 对于权限管理模块，每次都重新加载脚本以确保事件正确绑定
    if (existingScript && moduleName !== 'permissions') {
      // 如果脚本已加载，对于dashboard模块，确保初始化
      if (moduleName === 'dashboard' && document.querySelector('.dashboard')) {
        setTimeout(() => {
          if (window.DashboardModule && !window.dashboardModule) {
            window.dashboardModule = new window.DashboardModule();
            window.dashboardModule.loadStats();
          } else if (window.dashboardModule) {
            window.dashboardModule.loadStats();
          }
        }, 100);
      }
      return; // 脚本已加载
    }
    
    // 如果是权限管理模块且脚本已存在，先移除
    if (existingScript && moduleName === 'permissions') {
      existingScript.remove();
    }
    
    const script = document.createElement('script');
    script.src = scriptName;
    script.setAttribute('data-module', scriptName);
    script.onload = () => {
      console.log(`模块脚本 ${scriptName} 加载成功`);
      // 对于dashboard模块，确保初始化
      if (moduleName === 'dashboard' && document.querySelector('.dashboard')) {
        setTimeout(() => {
          if (window.DashboardModule && !window.dashboardModule) {
            window.dashboardModule = new window.DashboardModule();
            window.dashboardModule.loadStats();
          } else if (window.dashboardModule) {
            window.dashboardModule.loadStats();
          }
        }, 100);
      }
    };
    script.onerror = () => {
      console.warn(`模块脚本 ${scriptName} 未找到，可能不需要`);
    };
    document.body.appendChild(script);
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    this.applyTheme();
  }

  applyTheme() {
    const layout = document.querySelector('.console-layout');
    const themeIcon = document.getElementById('theme-icon');
    
    if (layout) {
      layout.classList.toggle('dark', this.theme === 'dark');
    }
    
    if (themeIcon) {
      themeIcon.textContent = this.theme === 'dark' ? '☀️' : '🌙';
    }
  }

  handleUserAction(action) {
    switch (action) {
      case 'profile':
        alert('个人设置功能待实现');
        break;
      case 'settings':
        alert('系统设置功能待实现');
        break;
      case 'logout':
        if (confirm('确定要返回主界面吗？')) {
          window.location.href = '/ui/videochat.html';
        }
        break;
      default:
        console.log('未知操作:', action);
    }
  }
}

// 初始化控制台
document.addEventListener('DOMContentLoaded', () => {
  window.consoleManager = new ConsoleManager();
  
  // 监听浏览器前进后退
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.module) {
      window.consoleManager.switchModule(e.state.module);
    }
  });
});

