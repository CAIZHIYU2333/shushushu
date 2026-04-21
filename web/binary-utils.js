// 二进制工具函数
// 注意：这些函数依赖外部库，如果不需要可以暂时留空或使用简化实现

/**
 * 解包Blob数据
 * @param {Blob} blob - 要解包的Blob对象
 * @param {string} str - 格式字符串，默认为 '<II'
 * @returns {Promise<{parsedData: any, jsonSize: number, binSize: number}>}
 */
async function unpack(blob, str = '<II') {
  // 简化实现：如果不需要完整功能，可以返回基本结构
  // 完整实现需要 python-struct 和 Buffer
  try {
    const unpackBuffer = await blob.slice(4, 12).arrayBuffer();
    // 这里需要 python-struct 库来解析
    // 暂时返回占位符
    const jsonSize = 0;
    const binSize = 0;
    const jsonBlob = await blob.slice(12, 12 + jsonSize).text();
    const parsedData = jsonBlob ? JSON.parse(jsonBlob) : {};
    return {
      parsedData,
      jsonSize,
      binSize,
    };
  } catch (error) {
    console.warn('unpack failed, using fallback:', error);
    return {
      parsedData: {},
      jsonSize: 0,
      binSize: 0,
    };
  }
}

/**
 * 合并Blob数据
 * @param {string[]} strArray - Base64字符串数组
 * @param {Uint8Array} target - 目标Uint8Array
 * @returns {Blob}
 */
function mergeBlob(strArray, target) {
  // 简化实现：需要 base64-js 库
  // 暂时使用浏览器原生方法
  try {
    let offset = 0;
    strArray.forEach((str) => {
      // 使用 atob 解码 base64
      const binaryString = atob(str);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      target.set(bytes, offset);
      offset += bytes.byteLength;
    });
    return new Blob([target]);
  } catch (error) {
    console.warn('mergeBlob failed:', error);
    return new Blob([target]);
  }
}

// 导出到全局
window.binaryUtils = {
  unpack,
  mergeBlob,
};

