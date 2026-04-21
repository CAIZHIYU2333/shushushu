// 数字人管理模块逻辑
class AvatarsModule {
  constructor() {
    this.avatars = [];
    this.availableAvatars = []; // 可用的数字人形象列表
    this.editingAvatar = null;
    this.configVisibility = {}; // 存储配置显示/隐藏状态
    this.init();
  }

  init() {
    this.loadAvailableAvatars();
    this.loadAvatars();
    this.bindEvents();
  }

  async loadAvailableAvatars() {
    try {
      const api = window.apiService;
      if (!api) {
        console.error('❌ apiService不存在');
        return;
      }
      
      console.log('🔄 开始加载可用数字人形象列表...');
      const response = await api.getAvailableAvatars();
      console.log('📦 可用数字人形象响应:', response);
      
      if (response.success && response.data) {
        let avatarsData = response.data;
        
        // 处理嵌套的响应结构
        if (avatarsData && typeof avatarsData === 'object' && avatarsData.data) {
          avatarsData = avatarsData.data;
        }
        
        if (Array.isArray(avatarsData)) {
          this.availableAvatars = avatarsData;
        } else {
          this.availableAvatars = [];
        }
        console.log('✅ 可用数字人形象列表加载成功，数量:', this.availableAvatars.length);
        this.updateAvatarNameSelect();
      } else {
        console.error('❌ 加载可用数字人形象列表失败:', response.error);
      }
    } catch (error) {
      console.error('❌ 加载可用数字人形象列表异常:', error);
    }
  }

  updateAvatarNameSelect() {
    const select = document.getElementById('avatar-avatar-name');
    if (!select) return;

    // 保留当前选中的值
    const currentValue = select.value;

    // 清空并重新填充选项
    select.innerHTML = '<option value="">请选择数字人形象</option>';
    
    if (this.availableAvatars.length === 0) {
      // 如果没有可用选项，显示提示
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未找到数字人形象（请检查resource/avatar/liteavatar目录）';
      option.disabled = true;
      select.appendChild(option);
    } else {
      this.availableAvatars.forEach(avatar => {
        const option = document.createElement('option');
        option.value = avatar.path;
        option.textContent = avatar.name;
        select.appendChild(option);
      });
    }

    // 恢复之前选中的值
    if (currentValue) {
      select.value = currentValue;
    }
  }

  async loadAvatars() {
    const tbody = document.getElementById('avatars-tbody');
    if (!tbody) {
      console.error('❌ 找不到avatars-tbody元素');
      return;
    }

    tbody.innerHTML = '<tr><td colspan="7" class="loading">加载中...</td></tr>';

    try {
      const api = window.apiService;
      if (!api) {
        console.error('❌ apiService不存在');
        tbody.innerHTML = '<tr><td colspan="7" class="loading">API服务未初始化</td></tr>';
        return;
      }
      
      console.log('🔄 开始加载数字人数据...');
      const response = await api.getAvatars();
      console.log('📦 数字人数据响应:', response);
      
      if (response.success && response.data) {
        let avatarsData = response.data;
        
        // 处理嵌套的响应结构
        if (avatarsData && typeof avatarsData === 'object' && avatarsData.data) {
          avatarsData = avatarsData.data;
        }
        
        if (Array.isArray(avatarsData)) {
          this.avatars = avatarsData;
        } else {
          this.avatars = [];
        }
        console.log('✅ 数字人数据加载成功，数量:', this.avatars.length);
        this.renderAvatars();
      } else {
        console.error('❌ 数字人数据加载失败:', response.error);
        tbody.innerHTML = `<tr><td colspan="7" class="loading">${response.error || '加载失败'}</td></tr>`;
      }
    } catch (error) {
      console.error('❌ 加载数字人数据异常:', error);
      tbody.innerHTML = `<tr><td colspan="7" class="loading">加载失败: ${error.message}</td></tr>`;
    }
  }

  renderAvatars() {
    const tbody = document.getElementById('avatars-tbody');
    if (!tbody) return;

    if (this.avatars.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = this.avatars.map(avatar => {
      const config = avatar.config || '';
      const configPreview = config.length > 100 ? config.substring(0, 100) + '...' : config;
      const isConfigExpanded = this.configVisibility[avatar.id] || false;
      const configDisplay = isConfigExpanded ? config : configPreview;
      
      return `
      <tr>
        <td>${avatar.id || '-'}</td>
        <td>${avatar.name || '-'}</td>
        <td><span class="tag tag-blue">${avatar.avatar_type || 'LiteAvatar'}</span></td>
        <td>${avatar.avatar_name || '-'}</td>
        <td>${avatar.preview || '-'}</td>
        <td class="config-cell">
          <span class="config-preview ${isConfigExpanded ? 'expanded' : ''}" 
                title="${config}" 
                onclick="window.avatarsModule.toggleConfig('${avatar.id}')"
                style="cursor: ${config.length > 100 ? 'pointer' : 'default'};">
            ${configDisplay}
          </span>
          ${config.length > 100 ? `<button class="config-toggle-btn" onclick="window.avatarsModule.toggleConfig('${avatar.id}')" title="点击展开/收起">${isConfigExpanded ? '收起' : '展开'}</button>` : ''}
        </td>
        <td>
          <button class="btn-link" onclick="window.avatarsModule.editAvatar('${avatar.id}')">修改</button>
          <button class="btn-link danger" onclick="window.avatarsModule.deleteAvatar('${avatar.id}')">删除</button>
          <button class="btn-link" style="color: #52c41a;" onclick="window.avatarsModule.applyConfig('${avatar.id}')" title="应用配置到glut2.yaml">应用</button>
        </td>
      </tr>
    `;
    }).join('');
  }
  
  toggleConfig(avatarId) {
    this.configVisibility[avatarId] = !this.configVisibility[avatarId];
    this.renderAvatars();
  }

  bindEvents() {
    console.log('🔗 开始绑定数字人管理事件...');
    
    // 添加数字人按钮 - 使用onclick和事件委托
    const addAvatarBtn = document.getElementById('add-avatar-btn');
    if (addAvatarBtn) {
      addAvatarBtn.onclick = (e) => {
        console.log('🖱️ 点击添加数字人按钮');
        e.preventDefault();
        e.stopPropagation();
        if (window.avatarsModule) {
          window.avatarsModule.showAvatarModal();
        }
      };
      console.log('✅ 添加数字人按钮事件已绑定');
    }
    
    // 事件委托到document
    if (!this._documentClickHandler) {
      this._documentClickHandler = (e) => {
        if (e.target && e.target.id === 'add-avatar-btn') {
          console.log('🖱️ 点击添加数字人按钮（事件委托）');
          e.preventDefault();
          e.stopPropagation();
          if (window.avatarsModule) {
            window.avatarsModule.showAvatarModal();
          }
        }
      };
      document.addEventListener('click', this._documentClickHandler);
    }

    // 数字人模态框 - 使用onclick
    const avatarModal = document.getElementById('avatar-modal');
    const avatarModalClose = document.getElementById('avatar-modal-close');
    const avatarModalCancel = document.getElementById('avatar-modal-cancel');
    const avatarModalSubmit = document.getElementById('avatar-modal-submit');

    if (avatarModalClose) {
      avatarModalClose.onclick = (e) => {
        e.preventDefault();
        if (window.avatarsModule) {
          window.avatarsModule.hideAvatarModal();
        }
      };
    }
    if (avatarModalCancel) {
      avatarModalCancel.onclick = (e) => {
        e.preventDefault();
        if (window.avatarsModule) {
          window.avatarsModule.hideAvatarModal();
        }
      };
    }
    if (avatarModalSubmit) {
      avatarModalSubmit.onclick = (e) => {
        e.preventDefault();
        if (window.avatarsModule) {
          window.avatarsModule.handleAvatarSubmit();
        }
      };
    }
    if (avatarModal) {
      avatarModal.onclick = (e) => {
        if (e.target === avatarModal && window.avatarsModule) {
          window.avatarsModule.hideAvatarModal();
        }
      };
    }
    
    console.log('✅ 数字人管理事件绑定完成');
  }

  showAvatarModal(avatar = null) {
    this.editingAvatar = avatar;
    const modal = document.getElementById('avatar-modal');
    const title = document.getElementById('avatar-modal-title');
    const form = document.getElementById('avatar-form');

    if (title) {
      title.textContent = avatar ? '修改数字人' : '添加数字人';
    }

    // 确保可用数字人列表已加载
    if (this.availableAvatars.length === 0) {
      this.loadAvailableAvatars().then(() => {
        this.fillForm(avatar);
      });
    } else {
      this.fillForm(avatar);
    }

    if (modal) {
      modal.classList.add('show');
    }
  }

  fillForm(avatar) {
    const form = document.getElementById('avatar-form');
    if (!form) return;

    form.reset();
    
    // 先更新选择框选项
    this.updateAvatarNameSelect();
    
    // 等待DOM更新后再设置值
    setTimeout(() => {
      if (avatar) {
        const nameInput = document.getElementById('avatar-name');
        const typeSelect = document.getElementById('avatar-type');
        const avatarNameSelect = document.getElementById('avatar-avatar-name');
        const previewInput = document.getElementById('avatar-preview');
        const configTextarea = document.getElementById('avatar-config');
        
        if (nameInput) nameInput.value = avatar.name || '';
        if (typeSelect) typeSelect.value = avatar.avatar_type || 'LiteAvatar';
        if (avatarNameSelect) {
          // 设置数字人形象选择框的值
          const avatarName = avatar.avatar_name || '';
          avatarNameSelect.value = avatarName;
          // 如果值不在选项中，添加一个选项
          if (avatarName && !Array.from(avatarNameSelect.options).some(opt => opt.value === avatarName)) {
            const option = document.createElement('option');
            option.value = avatarName;
            option.textContent = avatarName + ' (当前配置)';
            avatarNameSelect.appendChild(option);
            avatarNameSelect.value = avatarName;
          }
        }
        if (previewInput) previewInput.value = avatar.preview || '';
        if (configTextarea) configTextarea.value = avatar.config || '';
      }
    }, 100);
  }

  hideAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    if (modal) {
      modal.classList.remove('show');
    }
    this.editingAvatar = null;
  }

  async handleAvatarSubmit() {
    const name = document.getElementById('avatar-name').value;
    const avatarType = document.getElementById('avatar-type').value;
    const avatarName = document.getElementById('avatar-avatar-name').value;
    const preview = document.getElementById('avatar-preview').value;
    const config = document.getElementById('avatar-config').value;

    if (!name || !avatarName || !config) {
      alert('请填写必填项（名称、包名、配置）');
      return;
    }

    const avatarData = {
      name,
      avatar_type: avatarType,
      avatar_name: avatarName,
      preview,
      config,
    };

    try {
      const api = window.apiService;
      let response;
      if (this.editingAvatar) {
        response = await api.updateAvatar(this.editingAvatar.id, avatarData);
      } else {
        response = await api.createAvatar(avatarData);
      }

      if (response.success) {
        alert(this.editingAvatar ? '数字人更新成功' : '数字人创建成功');
        this.hideAvatarModal();
        this.loadAvatars();
      } else {
        alert(response.error || '操作失败');
      }
    } catch (error) {
      alert(error.message || '操作失败');
    }
  }

  editAvatar(avatarId) {
    const avatar = this.avatars.find(a => String(a.id) === String(avatarId));
    if (avatar) {
      this.showAvatarModal(avatar);
    }
  }

  async deleteAvatar(avatarId) {
    if (!confirm('确定要删除这个数字人吗？')) {
      return;
    }

    try {
      const api = window.apiService;
      const response = await api.deleteAvatar(avatarId);
      if (response.success) {
        alert('数字人删除成功');
        this.loadAvatars();
      } else {
        alert(response.error || '删除失败');
      }
    } catch (error) {
      alert(error.message || '删除失败');
    }
  }

  async applyConfig(avatarId) {
    if (!confirm('确定要应用此配置到glut2.yaml吗？应用后需要重启服务才能生效。')) {
      return;
    }

    try {
      const api = window.apiService;
      const response = await fetch(`${window.location.origin}/api/admin/avatars/${avatarId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      if (result.success) {
        alert('配置已成功更新到glut2.yaml，请重启服务使配置生效');
      } else {
        alert(result.error || '应用配置失败');
      }
    } catch (error) {
      alert(error.message || '应用配置失败');
    }
  }
}

// 将AvatarsModule暴露到全局
window.AvatarsModule = AvatarsModule;

// 初始化数字人管理模块
function initAvatars() {
  const avatarElement = document.querySelector('.avatar-management') || 
                        document.querySelector('.module-content.avatar-management');
  
  console.log('🔍 检查数字人管理初始化:', {
    'avatar元素存在': !!avatarElement,
    'avatarsModule已存在': !!window.avatarsModule,
    'AvatarsModule类存在': !!window.AvatarsModule
  });
  
  if (avatarElement && !window.avatarsModule) {
    try {
      window.avatarsModule = new AvatarsModule();
      console.log('✅ 数字人管理模块已初始化');
    } catch (e) {
      console.error('❌ 数字人管理模块初始化失败:', e);
    }
  } else if (avatarElement && window.avatarsModule) {
    console.log('🔄 数字人管理模块已存在，重新加载数据');
    if (window.avatarsModule.loadAvatars) {
      window.avatarsModule.loadAvatars();
    }
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAvatars);
} else {
  initAvatars();
}

// 也支持延迟初始化（当模块动态加载时）
setTimeout(initAvatars, 300);
setTimeout(initAvatars, 800);
setTimeout(initAvatars, 1500);


