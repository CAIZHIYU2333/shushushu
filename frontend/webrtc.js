// WebRTC连接管理

/**
 * 创建PeerConnection
 */
function createPeerConnection(pc, node) {
    // 注册监听器用于调试
    pc.addEventListener('icegatheringstatechange', () => {
        console.debug(pc.iceGatheringState);
    }, false);

    pc.addEventListener('iceconnectionstatechange', () => {
        console.debug(pc.iceConnectionState);
    }, false);

    pc.addEventListener('signalingstatechange', () => {
        console.debug(pc.signalingState);
    }, false);

    // 连接服务器音频/视频到本地
    pc.addEventListener('track', (evt) => {
        console.debug('track event listener');
        if (node && node.srcObject !== evt.streams[0]) {
            console.debug('streams', evt.streams);
            node.srcObject = evt.streams[0];
            console.debug('node.srcObject', node.srcObject);
            if (evt.track.kind === 'audio') {
                node.volume = 1.0;
                node.muted = false;
                node.autoplay = true;
                node.play().catch((e) => console.debug('Autoplay failed:', e));
            }
        }
    });

    return pc;
}

/**
 * 停止PeerConnection
 */
function stop(pc) {
    console.debug('Stopping peer connection');
    // 关闭transceivers
    if (pc.getTransceivers) {
        pc.getTransceivers().forEach((transceiver) => {
            if (transceiver.stop) {
                transceiver.stop();
            }
        });
    }

    // 关闭本地音频/视频
    if (pc.getSenders()) {
        pc.getSenders().forEach((sender) => {
            console.log('sender', sender);
            if (sender.track && sender.track.stop) sender.track.stop();
        });
    }

    // 关闭peer connection
    setTimeout(() => {
        pc.close();
    }, 500);
}

/**
 * 设置WebRTC连接
 */
async function setupWebRTC(stream, peerConnection, remoteNode) {
    // 发送音频-视频流到服务器
    stream.getTracks().forEach(async (track) => {
        const sender = peerConnection.addTrack(track, stream);
    });

    peerConnection.addEventListener('track', (evt) => {
        if (remoteNode && remoteNode.srcObject !== evt.streams[0]) {
            remoteNode.srcObject = evt.streams[0];
        }
    });

    // 创建数据通道
    const dataChannel = peerConnection.createDataChannel('text');

    // 创建并发送offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const webrtc_id = Math.random().toString(36).substring(7);

    // 发送ICE候选到服务器
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            console.debug('Sending ICE candidate', candidate);
            fetch('/webrtc/offer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidate: candidate.toJSON(),
                    webrtc_id,
                    type: 'ice-candidate',
                }),
            }).catch((err) => console.error('Error sending ICE candidate:', err));
        }
    };

    // 发送offer到服务器
    const response = await fetch('/webrtc/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
            webrtc_id,
        }),
    });

    // 处理服务器响应
    const serverResponse = await response.json();
    await peerConnection.setRemoteDescription(serverResponse);
    return [dataChannel, webrtc_id];
}

// 导出函数
window.webrtcUtils = {
    createPeerConnection,
    stop,
    setupWebRTC,
};

