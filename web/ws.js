// WebSocket连接管理

class WS {
    constructor(url) {
        this.engine = undefined;
        this._inited = false;
        this.listeners = new Map();
        this._init(url);
    }

    _init(url) {
        if (this._inited) {
            return;
        }
        this._inited = true;
        this.engine = new WebSocket(url);
        this.engine.addEventListener('error', (event) => {
            this.emit('WS_ERROR', event);
        });
        this.engine.addEventListener('open', () => {
            this.emit('WS_OPEN');
        });
        this.engine.addEventListener('message', (event) => {
            this.emit('WS_MESSAGE', event.data);
        });
        this.engine.addEventListener('close', () => {
            this.emit('WS_CLOSE');
        });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('WebSocket事件监听器错误:', error);
                }
            });
        }
    }

    send(data) {
        if (this.engine && this.engine.readyState === WebSocket.OPEN) {
            this.engine.send(data);
        }
    }

    stop() {
        this.emit('WS_CLOSE');
        this._inited = false;
        if (this.engine) {
            this.engine.close();
        }
    }
}

// 导出类
window.WS = WS;

