class KnowledgeGraphViewer {
  constructor() {
    this.network = null;
    this.nodes = null;
    this.currentData = null;
    this.cacheDom();
    this.bindTabs();
  }

  cacheDom() {
    this.container = document.getElementById('kg-network-container');
    this.detailPanel = document.getElementById('kg-node-detail');
    this.tabBtns = document.querySelectorAll('#teaching-knowledge-modal .kg-tab-btn');
    this.tabPanels = document.querySelectorAll('#teaching-knowledge-modal .kg-tab-panel');
    this.loading = document.getElementById('kg-loading');
    this.loadingText = document.getElementById('kg-loading-text');
  }

  bindTabs() {
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.tabBtns.forEach(b => b.classList.remove('active'));
        this.tabPanels.forEach(p => p.style.display = 'none');
        btn.classList.add('active');
        const target = document.getElementById('kg-tab-' + btn.dataset.tab);
        if (target) target.style.display = 'block';
      });
    });
  }

  setLoading(loading, text) {
    if (this.loading) this.loading.style.display = loading ? 'flex' : 'none';
    if (this.loadingText && text) this.loadingText.textContent = text;
  }

  async generateFromSubject() {
    const subject = document.getElementById('kg-subject').value;
    const topic = document.getElementById('kg-topic').value.trim();
    if (!topic) { alert('请输入主题'); return; }
    this.setLoading(true, '正在分析学科主题生成知识图谱...');
    try {
      const res = await fetch('/api/knowledge/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topic }),
      });
      const data = await res.json();
      if (data.success) this.render(data.data);
      else alert('生成失败: ' + (data.error || '未知'));
    } catch (e) { alert('网络错误: ' + e.message); }
    this.setLoading(false);
  }

  async extractFromText() {
    const content = document.getElementById('kg-text-input').value.trim();
    if (!content) { alert('请输入或粘贴文本'); return; }
    this.setLoading(true, '正在从文本中提取知识图谱...');
    try {
      const res = await fetch('/api/knowledge/extract-from-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, source: '手动输入' }),
      });
      const data = await res.json();
      if (data.success) this.render(data.data);
      else alert('提取失败: ' + (data.error || '未知'));
    } catch (e) { alert('网络错误: ' + e.message); }
    this.setLoading(false);
  }

  async extractFromConversation() {
    const summary = document.getElementById('kg-conv-input').value.trim();
    if (!summary) { alert('请粘贴对话记录或输入总结文本'); return; }
    this.setLoading(true, '正在从对话记录中提取知识图谱...');
    try {
      const res = await fetch('/api/knowledge/summarize-conversation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, conversation: [] }),
      });
      const data = await res.json();
      if (data.success) this.render(data.data);
      else alert('提取失败: ' + (data.error || '未知'));
    } catch (e) { alert('网络错误: ' + e.message); }
    this.setLoading(false);
  }

  async extractFromFile() {
    const fileInput = document.getElementById('kg-file-input');
    const file = fileInput.files[0];
    if (!file) { alert('请选择文件'); return; }
    this.setLoading(true, '正在分析文件提取知识图谱...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/knowledge/extract-from-file', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.success) this.render(data.data);
      else alert('提取失败: ' + (data.error || '未知'));
    } catch (e) { alert('网络错误: ' + e.message); }
    this.setLoading(false);
  }

  render(data) {
    if (!data || !data.nodes) {
      alert('图谱数据无效'); return;
    }
    this.currentData = data;

    const nodes = new vis.DataSet(data.nodes.map(n => ({
      id: n.id,
      label: n.label,
      group: n.group || 'core',
      level: n.level || 1,
      title: `<b>${n.label}</b><br>${n.desc || ''}<br>分组: ${n.group}`,
      font: { size: 14 + (4 - (n.level || 1)) * 4 },
      shape: n.group === 'core' ? 'dot' : n.group === 'basic' ? 'box' : 'ellipse',
      size: 20 + (4 - (n.level || 1)) * 10,
    })));

    const edges = new vis.DataSet((data.edges || []).map(e => ({
      from: e.source,
      to: e.target,
      label: e.label || '',
      arrows: 'to',
      color: { color: e.type === 'prerequisite' ? '#f59e0b' : e.type === 'component' ? '#6366f1' : '#94a3b8' },
      font: { size: 10, color: '#666' },
      width: e.type === 'prerequisite' ? 2 : 1,
    })));

    this.nodes = nodes;

    if (this.network) {
      this.network.setData({ nodes, edges });
    } else {
      this.network = new vis.Network(this.container, { nodes, edges }, {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -80, centralGravity: 0.005, springLength: 160 },
          stabilization: { iterations: 200 },
        },
        interaction: { dragNodes: true, dragView: true, zoomView: true, hover: true },
        nodes: { borderWidth: 2, shadow: { enabled: true, size: 10 } },
        groups: {
          core: { color: { background: '#7170ff', border: '#5046e0', highlight: '#8b85ff' } },
          basic: { color: { background: '#22c55e', border: '#16a34a', highlight: '#4ade80' } },
          advanced: { color: { background: '#f59e0b', border: '#d97706', highlight: '#fbbf24' } },
          application: { color: { background: '#3b82f6', border: '#2563eb', highlight: '#60a5fa' } },
        },
      });

      this.network.on('click', params => {
        if (params.nodes.length > 0) {
          this.showNodeDetail(params.nodes[0]);
        }
      });
      this.network.on('stabilizationIterationsDone', () => {
        this.network.setOptions({ physics: false });
      });
    }

    this.container.style.display = 'block';
    this.container.style.height = '420px';
  }

  showNodeDetail(nodeId) {
    const panel = this.detailPanel;
    if (!this.currentData || !this.currentData.nodes) return;
    const node = this.currentData.nodes.find(n => n.id === nodeId || n.label === nodeId);
    if (!panel || !node) return;

    const connectedEdges = (this.currentData.edges || []).filter(
      e => e.source === node.id || e.target === node.id
    );

    panel.innerHTML = `
      <div class="kg-detail-card">
        <h4>${this.escapeHtml(node.label)}</h4>
        <div class="kg-detail-tags">
          <span class="kg-tag kg-tag-${node.group}">${node.group}</span>
          <span class="kg-tag kg-tag-level">Lv.${node.level}</span>
        </div>
        <p class="kg-detail-desc">${this.escapeHtml(node.desc || '暂无描述')}</p>
        ${connectedEdges.length > 0 ? `
        <div class="kg-detail-edges">
          <h5>关联关系 (${connectedEdges.length})</h5>
          ${connectedEdges.map(e => {
            const other = e.source === node.id ? e.target : e.source;
            const dir = e.source === node.id ? '→' : '←';
            return `<div class="kg-edge-item">${dir} <b>${this.escapeHtml(other)}</b> <span class="kg-edge-type">${this.escapeHtml(e.label || e.type)}</span></div>`;
          }).join('')}
        </div>` : ''}
      </div>
    `;
    panel.style.display = 'block';
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.KnowledgeGraphViewer = KnowledgeGraphViewer;
