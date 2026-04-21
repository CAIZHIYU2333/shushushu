// 通用工具函数

/**
 * 点击外部区域回调
 * @param {Node} node - 要监听的DOM节点
 * @param {Function} cb - 回调函数
 * @returns {Object} 返回destroy方法用于清理
 */
function clickOutside(node, cb) {
  const handleClick = (event) => {
    if (
      node &&
      !node.contains(event.target) &&
      !event.defaultPrevented
    ) {
      cb(event);
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    },
  };
}

/**
 * 在字符串指定位置插入字符串
 * @param {string} rawStr - 原始字符串
 * @param {string} insertString - 要插入的字符串
 * @param {number} index - 插入位置
 * @returns {string} 插入后的字符串
 */
function insertStringAt(rawStr, insertString, index) {
  if (index < 0 || index > rawStr.length) {
    console.error('索引超出范围');
    return rawStr;
  }

  return rawStr.substring(0, index) + insertString + rawStr.substring(index);
}

// 导出到全局
window.utils = {
  clickOutside,
  insertStringAt,
};

