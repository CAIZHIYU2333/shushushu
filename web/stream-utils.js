// 媒体流工具函数

let video_track = null;
let audio_track = null;

/**
 * 获取设备列表
 */
function getDevices() {
    return navigator.mediaDevices.enumerateDevices();
}

/**
 * 设置本地视频流
 */
function setLocalStream(local_stream, video_source) {
    video_source.srcObject = local_stream;
    video_source.muted = true;
    video_source.play();
}

/**
 * 获取媒体流
 */
async function getStream(audio, video, track_constraints) {
    const video_fallback_constraints = track_constraints?.video || track_constraints || {
        width: { ideal: 500 },
        height: { ideal: 500 },
    };
    const audio_fallback_constraints = track_constraints?.audio || track_constraints || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    };
    const constraints = {
        video: typeof video === 'object' ? { ...video, ...video_fallback_constraints } : video,
        audio: typeof audio === 'object' ? { ...audio, ...audio_fallback_constraints } : audio,
    };
    console.log(constraints, 'constraints');
    return navigator.mediaDevices.getUserMedia(constraints).then((local_stream) => {
        console.log(local_stream);
        return local_stream;
    });
}

/**
 * 设置可用设备列表
 */
function setAvailableDevices(devices, kind = 'videoinput') {
    return devices.filter((device) => device.kind === kind);
}

/**
 * 创建模拟视频轨道
 */
function createSimulatedVideoTrack(width = 1, height = 1) {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.width = width || 500;
    canvas.height = height || 500;
    canvas.style.width = '1px';
    canvas.style.height = '1px';
    canvas.style.position = 'fixed';
    canvas.style.visibility = 'hidden';
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function drawFrame() {
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
    }
    drawFrame();

    const stream = canvas.captureStream(30);
    video_track = stream.getVideoTracks()[0];
    video_track.stop = () => {
        canvas.remove();
    };
    video_track.onended = () => {
        if (video_track) video_track.stop();
    };
    return video_track;
}

/**
 * 创建模拟音频轨道
 */
function createSimulatedAudioTrack() {
    if (audio_track) return audio_track;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    oscillator.frequency.setValueAtTime(0, audioContext.currentTime);

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    const destination = audioContext.createMediaStreamDestination();
    oscillator.connect(gainNode);
    gainNode.connect(destination);
    oscillator.start();

    audio_track = destination.stream.getAudioTracks()[0];
    audio_track.stop = () => {
        audioContext.close();
    };
    audio_track.onended = () => {
        if (audio_track) audio_track.stop();
    };
    return audio_track;
}

// 导出函数
window.streamUtils = {
    getDevices,
    setLocalStream,
    getStream,
    setAvailableDevices,
    createSimulatedVideoTrack,
    createSimulatedAudioTrack,
};

