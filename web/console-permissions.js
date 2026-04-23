// 权限管理模块逻辑
class PermissionsModule {
  constructor() {
    this.users = [];
    this.roles = [];
    this.editingUser = null;
    this.editingRole = null;
    this.init();
  }

  init() {
    this.loadUsers();
    this.loadRoles();
    this.bindEvents();
  }

  async loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) {
      console.error('❌ 找不到users-tbody元素');
      return;
    }

    tbody.innerHTML = '<tr><td colspan="6" class="loading">加载中...</td></tr>';

    try {
      const api = window.apiService;
      if (!api) {
        console.error('❌ apiService不存在');
        tbody.innerHTML = '<tr><td colspan="6" class="loading">API服务未初始化</td></tr>';
        return;
      }
      
      console.log('🔄 开始加载用户数据...');
      const response = await api.getUsers();
      console.log('📦 用户数据响应:', response);
      
      if (response.success && response.data) {
        // api.js的request方法返回的data就是后端JSONResponse的整个内容
        // 后端返回: { "success": true, "data": [...] }
        // api.js返回: { success: true, data: { success: true, data: [...] } }
        let usersData = response.data;
        
        // 如果data是对象且包含data字段，说明是嵌套的响应
        if (usersData && typeof usersData === 'object' && usersData.data) {
          usersData = usersData.data;
        }
        
        // 现在usersData应该是数组
        if (Array.isArray(usersData)) {
          this.users = usersData;
        } else {
          this.users = [];
        }
        console.log('✅ 用户数据加载成功，数量:', this.users.length, '数据:', this.users);
        this.renderUsers();
      } else {
        console.error('❌ 用户数据加载失败:', response.error);
        tbody.innerHTML = `<tr><td colspan="6" class="loading">${response.error || '加载失败'}</td></tr>`;
      }
    } catch (error) {
      console.error('❌ 加载用户数据异常:', error);
      tbody.innerHTML = `<tr><td colspan="6" class="loading">加载失败: ${error.message}</td></tr>`;
    }
  }

  async loadRoles() {
    const tbody = document.getElementById('roles-tbody');
    if (!tbody) {
      console.error('❌ 找不到roles-tbody元素');
      return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="loading">加载中...</td></tr>';

    try {
      const api = window.apiService;
      if (!api) {
        console.error('❌ apiService不存在');
        tbody.innerHTML = '<tr><td colspan="5" class="loading">API服务未初始化</td></tr>';
        return;
      }
      
      console.log('🔄 开始加载角色数据...');
      const response = await api.getRoles();
      console.log('📦 角色数据响应:', response);
      
      if (response.success && response.data) {
        // api.js的request方法返回的data就是后端JSONResponse的整个内容
        // 后端返回: { "success": true, "data": [...] }
        // api.js返回: { success: true, data: { success: true, data: [...] } }
        let rolesData = response.data;
        
        // 如果data是对象且包含data字段，说明是嵌套的响应
        if (rolesData && typeof rolesData === 'object' && rolesData.data) {
          rolesData = rolesData.data;
        }
        
        // 现在rolesData应该是数组
        if (Array.isArray(rolesData)) {
          this.roles = rolesData;
        } else {
          this.roles = [];
        }
        console.log('✅ 角色数据加载成功，数量:', this.roles.length, '数据:', this.roles);
        this.renderRoles();
        this.updateRoleSelect();
      } else {
        console.error('❌ 角色数据加载失败:', response.error);
        tbody.innerHTML = `<tr><td colspan="5" class="loading">${response.error || '加载失败'}</td></tr>`;
      }
    } catch (error) {
      console.error('❌ 加载角色数据异常:', error);
      tbody.innerHTML = `<tr><td colspan="5" class="loading">加载失败: ${error.message}</td></tr>`;
    }
  }

  renderUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.users.map(user => {
      const email = user.email || '';
      const emailPrefix = email.length > 6 ? email.substring(0, 6) + '***' : email;
      return `
      <tr>
        <td>${user.id || '-'}</td>
        <td>${user.username || '-'}</td>
        <td>
          <span class="email-display" data-email="${email}" data-full="${email}">${emailPrefix}</span>
          ${email.length > 6 ? `<button class="email-toggle-btn" onclick="window.permissionsModule.toggleEmail('${user.id}')" title="点击显示/隐藏完整邮箱">👁</button>` : ''}
        </td>
        <td>${this.renderRoleTag(user.role)}</td>
        <td>${this.renderPermissions(user.permissions || [])}</td>
        <td>
          <button class="btn-link" onclick="window.permissionsModule.editUser('${user.id}')">编辑</button>
          <button class="btn-link danger" onclick="window.permissionsModule.deleteUser('${user.id}')">删除</button>
        </td>
      </tr>
    `;
    }).join('');
    
    // 存储邮箱显示状态
    this.emailVisibility = this.emailVisibility || {};
  }
  
  toggleEmail(userId) {
    if (!this.emailVisibility) {
      this.emailVisibility = {};
    }
    
    const row = document.querySelector(`tr:has(button[onclick*="'${userId}'"])`);
    if (!row) return;
    
    const emailDisplay = row.querySelector('.email-display');
    if (!emailDisplay) return;
    
    const fullEmail = emailDisplay.getAttribute('data-full');
    const isVisible = this.emailVisibility[userId] || false;
    
    if (isVisible) {
      // 隐藏：只显示前6位
      const prefix = fullEmail.length > 6 ? fullEmail.substring(0, 6) + '***' : fullEmail;
      emailDisplay.textContent = prefix;
      this.emailVisibility[userId] = false;
    } else {
      // 显示：显示完整邮箱
      emailDisplay.textContent = fullEmail;
      this.emailVisibility[userId] = true;
    }
  }

  renderRoles() {
    const tbody = document.getElementById('roles-tbody');
    if (!tbody) return;

    if (this.roles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.roles.map(role => `
      <tr>
        <td>${role.id || '-'}</td>
        <td>${role.name || '-'}</td>
        <td>${role.description || '-'}</td>
        <td>${this.renderPermissions(role.permissions || [])}</td>
        <td>
          <button class="btn-link" onclick="window.permissionsModule.editRole('${role.id}')">编辑</button>
          <button class="btn-link danger" onclick="window.permissionsModule.deleteRole('${role.id}')">删除</button>
        </td>
      </tr>
    `).join('');
  }

  renderRoleTag(role) {
    const colors = {
      admin: 'tag-red',
      user: 'tag-blue',
      guest: 'tag-default',
    };
    const colorClass = colors[role] || 'tag-default';
    return `<span class="tag ${colorClass}">${role || '-'}</span>`;
  }

  renderPermissions(permissions) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return '<span class="tag tag-default">无</span>';
    }
    return permissions.map(perm => `<span class="tag tag-blue">${perm}</span>`).join('');
  }

  updateRoleSelect() {
    const select = document.getElementById('user-role');
    if (!select) return;

    select.innerHTML = '<option value="">请选择角色</option>' +
      this.roles.map(role => `<option value="${role.name}">${role.name}</option>`).join('');
  }

  bindEvents() {
    console.log('🔗 开始绑定权限管理事件...');
    
    // 使用onclick属性直接绑定，这样即使DOM重新创建也能工作
    // 添加用户按钮
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
      addUserBtn.onclick = (e) => {
        console.log('🖱️ 点击添加用户按钮');
        e.preventDefault();
        e.stopPropagation();
        if (window.permissionsModule) {
          window.permissionsModule.showUserModal();
        }
      };
      console.log('✅ 添加用户按钮事件已绑定');
    } else {
      console.error('❌ 找不到add-user-btn元素');
    }

    // 添加角色按钮
    const addRoleBtn = document.getElementById('add-role-btn');
    if (addRoleBtn) {
      addRoleBtn.onclick = (e) => {
        console.log('🖱️ 点击添加角色按钮');
        e.preventDefault();
        e.stopPropagation();
        if (window.permissionsModule) {
          window.permissionsModule.showRoleModal();
        }
      };
      console.log('✅ 添加角色按钮事件已绑定');
    } else {
      console.error('❌ 找不到add-role-btn元素');
    }
    
    // 同时使用事件委托作为备用方案（绑定到document）
    if (!this._documentClickHandler) {
      this._documentClickHandler = (e) => {
        if (e.target && e.target.id === 'add-user-btn') {
          console.log('🖱️ 点击添加用户按钮（事件委托）');
          e.preventDefault();
          e.stopPropagation();
          if (window.permissionsModule) {
            window.permissionsModule.showUserModal();
          }
        } else if (e.target && e.target.id === 'add-role-btn') {
          console.log('🖱️ 点击添加角色按钮（事件委托）');
          e.preventDefault();
          e.stopPropagation();
          if (window.permissionsModule) {
            window.permissionsModule.showRoleModal();
          }
        }
      };
      document.addEventListener('click', this._documentClickHandler);
      console.log('✅ 事件委托已绑定到document');
    }

    // 用户模态框 - 使用onclick
    const userModal = document.getElementById('user-modal');
    const userModalClose = document.getElementById('user-modal-close');
    const userModalCancel = document.getElementById('user-modal-cancel');
    const userModalSubmit = document.getElementById('user-modal-submit');

    if (userModalClose) {
      userModalClose.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.hideUserModal();
        }
      };
    }
    if (userModalCancel) {
      userModalCancel.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.hideUserModal();
        }
      };
    }
    if (userModalSubmit) {
      userModalSubmit.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.handleUserSubmit();
        }
      };
    }
    if (userModal) {
      userModal.onclick = (e) => {
        if (e.target === userModal && window.permissionsModule) {
          window.permissionsModule.hideUserModal();
        }
      };
    }

    // 角色模态框 - 使用onclick
    const roleModal = document.getElementById('role-modal');
    const roleModalClose = document.getElementById('role-modal-close');
    const roleModalCancel = document.getElementById('role-modal-cancel');
    const roleModalSubmit = document.getElementById('role-modal-submit');

    if (roleModalClose) {
      roleModalClose.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.hideRoleModal();
        }
      };
    }
    if (roleModalCancel) {
      roleModalCancel.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.hideRoleModal();
        }
      };
    }
    if (roleModalSubmit) {
      roleModalSubmit.onclick = (e) => {
        e.preventDefault();
        if (window.permissionsModule) {
          window.permissionsModule.handleRoleSubmit();
        }
      };
    }
    if (roleModal) {
      roleModal.onclick = (e) => {
        if (e.target === roleModal && window.permissionsModule) {
          window.permissionsModule.hideRoleModal();
        }
      };
    }
    
    console.log('✅ 权限管理事件绑定完成');
  }

  showUserModal(user = null) {
    this.editingUser = user;
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const form = document.getElementById('user-form');

    if (title) {
      title.textContent = user ? '编辑用户' : '添加用户';
    }

    if (form) {
      form.reset();
      if (user) {
        document.getElementById('user-username').value = user.username || '';
        document.getElementById('user-email').value = user.email || '';
        document.getElementById('user-role').value = user.role || '';
        this.setCheckboxes('user-permissions', user.permissions || []);
      } else {
        this.setCheckboxes('user-permissions', []);
      }
    }

    if (modal) {
      modal.classList.add('show');
    }
  }

  hideUserModal() {
    const modal = document.getElementById('user-modal');
    if (modal) {
      modal.classList.remove('show');
    }
    this.editingUser = null;
  }

  showRoleModal(role = null) {
    this.editingRole = role;
    const modal = document.getElementById('role-modal');
    const title = document.getElementById('role-modal-title');
    const form = document.getElementById('role-form');

    if (title) {
      title.textContent = role ? '编辑角色' : '添加角色';
    }

    if (form) {
      form.reset();
      if (role) {
        document.getElementById('role-name').value = role.name || '';
        document.getElementById('role-description').value = role.description || '';
        this.setCheckboxes('role-permissions', role.permissions || []);
      } else {
        this.setCheckboxes('role-permissions', []);
      }
    }

    if (modal) {
      modal.classList.add('show');
    }
  }

  hideRoleModal() {
    const modal = document.getElementById('role-modal');
    if (modal) {
      modal.classList.remove('show');
    }
    this.editingRole = null;
  }

  setCheckboxes(containerId, values) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = values.includes(checkbox.value);
    });
  }

  getCheckboxes(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  async handleUserSubmit() {
    const username = document.getElementById('user-username').value;
    const email = document.getElementById('user-email').value;
    const role = document.getElementById('user-role').value;
    const permissions = this.getCheckboxes('user-permissions');

    if (!username || !role) {
      alert('请填写必填项');
      return;
    }

    const userData = { username, email, role, permissions };

    try {
      const api = window.apiService || apiService;
      let response;
      if (this.editingUser) {
        response = await api.updateUser(this.editingUser.id, userData);
      } else {
        response = await api.createUser(userData);
      }

      if (response.success) {
        alert(this.editingUser ? '用户更新成功' : '用户创建成功');
        this.hideUserModal();
        this.loadUsers();
      } else {
        alert(response.error || '操作失败');
      }
    } catch (error) {
      alert(error.message || '操作失败');
    }
  }

  async handleRoleSubmit() {
    const name = document.getElementById('role-name').value;
    const description = document.getElementById('role-description').value;
    const permissions = this.getCheckboxes('role-permissions');

    if (!name) {
      alert('请填写角色名称');
      return;
    }

    const roleData = { name, description, permissions };

    try {
      const api = window.apiService || apiService;
      let response;
      if (this.editingRole) {
        response = await api.updateRole(this.editingRole.id, roleData);
      } else {
        response = await api.createRole(roleData);
      }

      if (response.success) {
        alert(this.editingRole ? '角色更新成功' : '角色创建成功');
        this.hideRoleModal();
        this.loadRoles();
        this.updateRoleSelect();
      } else {
        alert(response.error || '操作失败');
      }
    } catch (error) {
      alert(error.message || '操作失败');
    }
  }

  editUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.showUserModal(user);
    }
  }

  async deleteUser(userId) {
    if (!confirm('确定要删除这个用户吗？')) {
      return;
    }

    try {
      const response = await (window.apiService || apiService).deleteUser(userId);
      if (response.success) {
        alert('用户删除成功');
        this.loadUsers();
      } else {
        alert(response.error || '删除失败');
      }
    } catch (error) {
      alert(error.message || '删除失败');
    }
  }

  editRole(roleId) {
    const role = this.roles.find(r => r.id === roleId);
    if (role) {
      this.showRoleModal(role);
    }
  }

  async deleteRole(roleId) {
    if (!confirm('确定要删除这个角色吗？')) {
      return;
    }

    try {
      const response = await (window.apiService || apiService).deleteRole(roleId);
      if (response.success) {
        alert('角色删除成功');
        this.loadRoles();
        this.updateRoleSelect();
      } else {
        alert(response.error || '删除失败');
      }
    } catch (error) {
      alert(error.message || '删除失败');
    }
  }
}

// 将PermissionsModule暴露到全局
window.PermissionsModule = PermissionsModule;

// 初始化权限管理模块
function initPermissions() {
  const permissionElement = document.querySelector('.permission-management') || 
                            document.querySelector('.module-content.permission-management');
  
  console.log('🔍 检查权限管理初始化:', {
    'permission元素存在': !!permissionElement,
    'permissionsModule已存在': !!window.permissionsModule,
    'PermissionsModule类存在': !!window.PermissionsModule
  });
  
  if (permissionElement && !window.permissionsModule) {
    try {
      window.permissionsModule = new PermissionsModule();
      console.log('✅ 权限管理模块已初始化');
    } catch (e) {
      console.error('❌ 权限管理模块初始化失败:', e);
    }
  } else if (permissionElement && window.permissionsModule) {
    console.log('🔄 权限管理模块已存在，重新加载数据');
    if (window.permissionsModule.loadUsers) {
      window.permissionsModule.loadUsers();
    }
    if (window.permissionsModule.loadRoles) {
      window.permissionsModule.loadRoles();
    }
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPermissions);
} else {
  initPermissions();
}

// 也支持延迟初始化（当模块动态加载时）
setTimeout(initPermissions, 300);
setTimeout(initPermissions, 800);
setTimeout(initPermissions, 1500);

