// DOM元素
const audioInput = document.getElementById('audioInput');
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');
const volumeControl = document.getElementById('volumeControl');
const volumeValue = document.getElementById('volumeValue');
const currentTimeDisplay = document.getElementById('currentTime');
const totalTimeDisplay = document.getElementById('totalTime');
const progressBar = document.querySelector('.progress');
const progressContainer = document.querySelector('.progress-bar');
const fileNameDisplay = document.querySelector('.file-info');

// 画布设置
const backgroundCanvas = document.getElementById('background');
const visualizerCanvas = document.getElementById('visualizer');
const fireworksCanvas = document.getElementById('fireworks');
const bgCtx = backgroundCanvas.getContext('2d', { willReadFrequently: true });
const visCtx = visualizerCanvas.getContext('2d', { willReadFrequently: true });
const fwCtx = fireworksCanvas.getContext('2d', { willReadFrequently: true });

// 全局变量
let audioContext;
let analyser;
let dataArray;
let source;
let isPlaying = false;
let lastPeakTime = 0;
let animationStarted = false;
const fireworkCooldown = 1000; // 烟花冷却时间（毫秒）
const soundThreshold = 0.3; // 降低声波触发烟花的阈值，使其更容易触发

// 星空和流星效果
const stars = [];
const shootingStars = [];
const starCount = 300;

// 烟花效果
const fireworks = []; // 升起的烟花
const particles = []; // 爆炸的粒子

// 波形平滑
let smoothedData = [];
const smoothingFactor = 0.8; // 平滑因子 (0-1)，越大越平滑

// 宇宙飞船进度条功能
function createSpaceshipIcon() {
    // 创建一个新的canvas元素来绘制飞船
    const shipCanvas = document.createElement('canvas');
    shipCanvas.width = 30;
    shipCanvas.height = 20;
    const shipCtx = shipCanvas.getContext('2d');
    
    // 绘制飞船主体
    shipCtx.fillStyle = '#00f7ff';
    shipCtx.beginPath();
    shipCtx.moveTo(25, 10); // 飞船头部
    shipCtx.lineTo(5, 5);   // 左上角
    shipCtx.lineTo(0, 10);  // 左中
    shipCtx.lineTo(5, 15);  // 左下角
    shipCtx.lineTo(25, 10); // 回到头部
    shipCtx.closePath();
    shipCtx.fill();
    
    // 绘制飞船窗口
    shipCtx.fillStyle = '#ffffff';
    shipCtx.beginPath();
    shipCtx.arc(15, 10, 3, 0, Math.PI * 2);
    shipCtx.fill();
    
    // 绘制引擎喷射
    shipCtx.fillStyle = '#ff5500';
    shipCtx.beginPath();
    shipCtx.moveTo(0, 10);
    shipCtx.lineTo(-5, 7);
    shipCtx.lineTo(-8, 10);
    shipCtx.lineTo(-5, 13);
    shipCtx.lineTo(0, 10);
    shipCtx.closePath();
    shipCtx.fill();
    
    // 添加发光效果
    shipCtx.shadowBlur = 10;
    shipCtx.shadowColor = '#00f7ff';
    shipCtx.strokeStyle = '#00f7ff';
    shipCtx.lineWidth = 1;
    shipCtx.stroke();
    
    // 返回飞船图像数据
    return shipCanvas;
}

function initSpaceshipProgressBar() {
    const spaceshipIcon = createSpaceshipIcon();
    
    // 添加CSS样式使进度条容器成为相对定位
    progressContainer.style.position = 'relative';
    progressContainer.style.overflow = 'visible';
    
    // 创建飞船元素并添加到DOM
    const shipElement = document.createElement('div');
    shipElement.id = 'spaceship';
    shipElement.style.position = 'absolute';
    shipElement.style.top = '-10px';
    shipElement.style.left = '0';
    shipElement.style.width = '30px';
    shipElement.style.height = '20px';
    shipElement.style.backgroundSize = 'contain';
    shipElement.style.backgroundRepeat = 'no-repeat';
    shipElement.style.backgroundPosition = 'center';
    shipElement.style.zIndex = '10';
    shipElement.style.transition = 'left 0.1s linear';
    shipElement.style.pointerEvents = 'none'; // 防止飞船干扰点击事件
    
    // 将飞船图像设置为背景
    const dataURL = spaceshipIcon.toDataURL();
    shipElement.style.backgroundImage = `url(${dataURL})`;
    
    progressContainer.appendChild(shipElement);
    
    // 添加CSS动画
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes fadeOut {
            0% { opacity: 0.7; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.5); }
        }
    `;
    document.head.appendChild(styleElement);
}

// 调整画布大小
function resizeCanvases() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    [backgroundCanvas, visualizerCanvas, fireworksCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
    });
    
    // 重新初始化背景
    initBackground();
    
    // 重置平滑数据数组
    if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        smoothedData = new Array(bufferLength).fill(128);
    }
}

// 初始化
window.addEventListener('load', () => {
    console.log('页面加载完成，开始初始化...');
    resizeCanvases();
    updateVolumeDisplay();
    initAudio();
    initBackground();
    
    // 添加空格键触发烟花的功能
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // 防止空格键滚动页面
            launchFirework(Math.random() * window.innerWidth, window.innerHeight);
        }
    });
    
    // 点击画布触发烟花
    fireworksCanvas.addEventListener('click', (e) => {
        launchFirework(e.clientX, window.innerHeight);
    });
    
    // 初始化宇宙飞船进度条
    initSpaceshipProgressBar();
    
    // 立即开始动画循环，不等待音乐播放
    startAnimations();
});

window.addEventListener('resize', resizeCanvases);

// 音频处理
function initAudio() {
    try {
        // 创建音频上下文
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        smoothedData = new Array(bufferLength).fill(128);
        
        console.log('音频上下文初始化成功');
    } catch (error) {
        console.error('音频初始化失败:', error);
    }
}

function connectAudioSource() {
    try {
        // 如果已有源，先断开
        if (source) {
            source.disconnect();
        }
        
        // 创建媒体源并连接
        source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        console.log('音频源连接成功');
    } catch (error) {
        console.error('连接音频源失败:', error);
    }
}

// 文件上传处理
audioInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        console.log('选择了文件:', file.name);
        
        // 创建文件URL
        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        
        // 显示文件名
        let fileName = file.name;
        if (fileName.length > 30) {
            fileName = fileName.substring(0, 27) + '...';
        }
        fileNameDisplay.textContent = fileName;
        
        // 连接音频源（每次选择新文件时都重新连接）
        try {
            if (audioContext.state === 'closed') {
                initAudio();
            }
            connectAudioSource();
        } catch (e) {
            console.error('重新连接音频源失败:', e);
            // 如果失败，尝试重新初始化
            initAudio();
            connectAudioSource();
        }
        
        // 重置播放状态
        isPlaying = false;
        playBtn.classList.remove('playing');
    }
});

// 播放控制
playBtn.addEventListener('click', togglePlay);

function togglePlay() {
    console.log('切换播放状态, 当前状态:', isPlaying);
    
    if (!audioPlayer.src) {
        console.log('没有选择音频文件');
        alert('请先选择一个音频文件');
        return;
    }
    
    // 确保音频上下文已恢复
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        playBtn.classList.remove('playing');
    } else {
        audioPlayer.play().catch(e => {
            console.error('播放失败:', e);
            alert('播放失败，请重试');
        });
        playBtn.classList.add('playing');
    }
    
    isPlaying = !isPlaying;
}

// 音量控制
volumeControl.addEventListener('input', function() {
    audioPlayer.volume = this.value;
    updateVolumeDisplay();
});

function updateVolumeDisplay() {
    const volume = Math.round(volumeControl.value * 100);
    volumeValue.textContent = volume + '%';
}

// 进度条更新
audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('loadedmetadata', updateTotalTime);

function updateProgress() {
    const currentTime = audioPlayer.currentTime;
    const duration = audioPlayer.duration || 0;
    
    if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        progressBar.style.width = progressPercent + '%';
        
        // 更新飞船位置
        const spaceship = document.getElementById('spaceship');
        if (spaceship) {
            // 计算飞船位置，考虑飞船宽度，使飞船中心对准进度点
            const shipPosition = (progressContainer.clientWidth * progressPercent / 100) - 15;
            spaceship.style.left = `${shipPosition}px`;
            
            // 添加小尾迹效果
            const trail = document.createElement('div');
            trail.className = 'ship-trail';
            trail.style.position = 'absolute';
            trail.style.width = '5px';
            trail.style.height = '5px';
            trail.style.borderRadius = '50%';
            trail.style.backgroundColor = 'rgba(0, 247, 255, 0.7)';
            trail.style.top = '7px';
            trail.style.left = `${shipPosition}px`;
            trail.style.zIndex = '9';
            trail.style.pointerEvents = 'none';
            
            // 添加动画效果
            trail.style.animation = 'fadeOut 1s forwards';
            
            // 添加到DOM
            progressContainer.appendChild(trail);
            
            // 一段时间后移除尾迹元素
            setTimeout(() => {
                if (trail.parentNode) {
                    trail.parentNode.removeChild(trail);
                }
            }, 1000);
        }
        
        // 更新当前时间显示
        currentTimeDisplay.textContent = formatTime(currentTime);
    }
}

function updateTotalTime() {
    totalTimeDisplay.textContent = formatTime(audioPlayer.duration);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 点击进度条跳转
progressContainer.addEventListener('click', function(e) {
    if (!audioPlayer.duration) return;
    
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    
    audioPlayer.currentTime = (clickX / width) * duration;
});

// 背景动画 - 星空
function initBackground() {
    console.log('初始化星空背景');
    stars.length = 0;
    
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * backgroundCanvas.width,
            y: Math.random() * backgroundCanvas.height,
            radius: Math.random() * 2.5,
            opacity: Math.random(),
            speed: 0.06 + Math.random() * 0.04, // 增加星星移动速度
            twinkleSpeed: 0.003 + Math.random() * 0.005,
            twinklePhase: Math.random() * Math.PI * 2
        });
    }
}

function drawBackground() {
    console.log("Background animation running...");
    requestAnimationFrame(drawBackground);
    // 清除背景
    bgCtx.fillStyle = 'rgba(5, 5, 24, 0.2)';
    bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    
    // 绘制星星
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        
        // 更新闪烁相位
        star.twinklePhase += star.twinkleSpeed;
        // 计算闪烁效果的不透明度
        const twinkleOpacity = 0.5 + 0.5 * Math.sin(star.twinklePhase);
        
        // 绘制星星的发光效果
        bgCtx.beginPath();
        bgCtx.arc(star.x, star.y, star.radius * 1.5, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkleOpacity * 0.3})`;
        bgCtx.fill();
        
        // 绘制星星的核心
        bgCtx.beginPath();
        bgCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkleOpacity})`;
        bgCtx.fill();
        
        // 偶尔绘制十字光芒
        if (star.radius > 1.5) {
            bgCtx.strokeStyle = `rgba(255, 255, 255, ${star.opacity * twinkleOpacity * 0.6})`;
            bgCtx.lineWidth = 0.5;
            bgCtx.beginPath();
            bgCtx.moveTo(star.x - star.radius * 2, star.y);
            bgCtx.lineTo(star.x + star.radius * 2, star.y);
            bgCtx.moveTo(star.x, star.y - star.radius * 2);
            bgCtx.lineTo(star.x, star.y + star.radius * 2);
            bgCtx.stroke();
        }
        
        // 移动星星
        star.y -= star.speed; // 向上移动，创造流动感
        
        // 如果星星移出画布，重置位置
        if (star.y < -star.radius) {  // 确保超出屏幕上方的星星被重置
          star.y = backgroundCanvas.height + star.radius;
          star.x = Math.random() * backgroundCanvas.width;
          star.radius = Math.random() * 2.5;
          star.opacity = Math.random();
      }
    }
    
    // 偶尔添加流星
    if (Math.random() < 0.05) { // 5%的几率每帧生成流星
        createShootingStar();
        console.log("创建流星");
    }
    
    // 绘制流星
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const star = shootingStars[i];
        
        // 绘制流星
        bgCtx.beginPath();
        bgCtx.moveTo(star.x, star.y);
        bgCtx.lineTo(star.x - star.vx * (star.length / star.speed), 
                     star.y - star.vy * (star.length / star.speed));
        
        // 创建渐变
        const gradient = bgCtx.createLinearGradient(
            star.x, star.y,
            star.x - star.vx * (star.length / star.speed),
            star.y - star.vy * (star.length / star.speed)
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        bgCtx.strokeStyle = gradient;
        bgCtx.lineWidth = 2;
        bgCtx.stroke();
        
        // 更新流星位置
        star.x += star.vx;
        star.y += star.vy;
        star.opacity -= star.decay;
        
        // 如果流星消失或移出画布，从数组中移除
        if (star.opacity <= 0 || 
          star.x < 0 || 
          star.x > backgroundCanvas.width || 
          star.y > backgroundCanvas.height) {  
          shootingStars.splice(i, 1);
        }
    }
}

// 流星效果
function createShootingStar() {
    const startX = Math.random() * backgroundCanvas.width;
    const startY = Math.random() * (backgroundCanvas.height / 3); // 在上部1/3区域生成
    const angle = Math.PI / 4 + Math.random() * Math.PI / 4; // 45-90度角
    const length = 100 + Math.random() * 150;
    const speed = 5 + Math.random() * 10;
    
    shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: length,
        opacity: 1,
        decay: 0.01 + Math.random() * 0.02
    });
    
    console.log("流星已创建:", startX, startY);
}

// 声波可视化
function drawSoundWave() {
    if (!analyser) return;
    
    try {
        // 即使不播放也绘制一个静态波形
        analyser.getByteTimeDomainData(dataArray);
        
        visCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        
        // 计算声波的平均强度
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            // 平滑处理
            if (isPlaying) {
                smoothedData[i] = smoothingFactor * smoothedData[i] + (1 - smoothingFactor) * dataArray[i];
            } else {
                // 静止状态下显示一条直线
                smoothedData[i] = 128;
            }
            
            sum += Math.abs((smoothedData[i] / 128.0) - 1);
        }
        const averageIntensity = sum / dataArray.length;
        
        // 如果强度超过阈值且不在冷却期，触发烟花
        const now = Date.now();
        if (isPlaying && averageIntensity > soundThreshold && now - lastPeakTime > fireworkCooldown) {
            // 触发多个烟花
            const fireworkCount = Math.floor(1 + Math.random() * 2); // 1-2个烟花
            for (let i = 0; i < fireworkCount; i++) {
                const x = Math.random() * visualizerCanvas.width;
                launchFirework(x, window.innerHeight);
                console.log("音频触发烟花:", averageIntensity);
            }
            lastPeakTime = now;
        }
        
        // 绘制声波 - 放在画布底部
        const waveHeight = visualizerCanvas.height / 6; // 波形高度
        const baseY = visualizerCanvas.height - waveHeight - 20; // 波形基线位置
        
        // 绘制波形
        visCtx.lineWidth = 2;
        visCtx.strokeStyle = `rgba(0, 247, 255, ${0.5 + averageIntensity})`;
        visCtx.shadowBlur = 10;
        visCtx.shadowColor = '#00f7ff';
        
        visCtx.beginPath();
        
        // 绘制声波线
        for (let i = 0; i < smoothedData.length; i++) {
            const x = (i / smoothedData.length) * visualizerCanvas.width;
            const y = baseY + ((smoothedData[i] / 128.0 - 1) * waveHeight);
            
            if (i === 0) {
                visCtx.moveTo(x, y);
            } else {
                visCtx.lineTo(x, y);
            }
        }
        
        visCtx.stroke();
        
        // 绘制镜像波形
        visCtx.strokeStyle = `rgba(125, 0, 255, ${0.3 + averageIntensity / 2})`;
        visCtx.shadowColor = '#7d00ff';
        
        visCtx.beginPath();
        
        for (let i = 0; i < smoothedData.length; i++) {
            const x = (i / smoothedData.length) * visualizerCanvas.width;
            const y = baseY - ((smoothedData[i] / 128.0 - 1) * waveHeight);
            
            if (i === 0) {
                visCtx.moveTo(x, y);
            } else {
                visCtx.lineTo(x, y);
            }
        }
        
        visCtx.stroke();
        visCtx.shadowBlur = 0;
        
        // 绘制基线
        visCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        visCtx.beginPath();
        visCtx.moveTo(0, baseY);
        visCtx.lineTo(visualizerCanvas.width, baseY);
        visCtx.stroke();
        
    } catch (error) {
        console.error('绘制声波时出错:', error);
    }
}

// 烟花效果 - 升起和爆炸
function launchFirework(x, startY) {
    const targetY = startY * 0.3 + Math.random() * (startY * 0.3); // 目标高度在屏幕上方30-60%处
    
    const colors = [
        '#00f7ff', // 青色
        '#7d00ff', // 紫色
        '#ff00e5', // 粉色
        '#00ff73', // 绿色
        '#ffcc00', // 金色
        '#ff3300'  // 红色
    ];
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fireworkType = Math.floor(Math.random() * 4);  // 随机选择烟花类型 (0: 普通, 1: 花朵, 2: 五角星, 3: 爱心)
    // 创建上升的烟花
    fireworks.push({
        x: x,
        y: startY,
        targetY: targetY,
        speed: 12 + Math.random() * 5,
        color: color,
        size: 3,
        trail: [], // 尾迹
        trailLength: 10, // 尾迹长度
        exploded: false,
        type: fireworkType 
    });
    
    console.log("烟花已发射:", x, startY, "目标高度:", targetY);
}

function createFireworks(x, y, color, type) {
    const particleCount = 150 + Math.floor(Math.random() * 100); // 150-250个粒子
    
    // 根据烟花类型创建不同的爆炸效果
    switch(type) {
        case 0: // 普通烟花 - 随机散开的粒子
            createNormalFirework(x, y, color, particleCount);
            break;
        case 1: // 花朵形状
            createFlowerFirework(x, y, color, particleCount);
            break;
        case 2: // 五角星形状
            createStarFirework(x, y, color, particleCount);
            break;
        case 3: // 爱心形状
            createHeartFirework(x, y, color, particleCount);
            break;
    }

    console.log("烟花爆炸:", x, y, "类型:", type, "粒子数:", particleCount);
    }

function createNormalFirework(x, y, color, particleCount) {
    // 创建爆炸粒子
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        const size = 1 + Math.random() * 2;
        
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            alpha: 1,
            size: size,
            gravity: 0.05 + Math.random() * 0.05,
            type: 0
        });
    }
}
function createFlowerFirework(x, y, color, particleCount) {
    const petalCount = 8; // 花瓣数量
    const particlesPerPetal = Math.floor(particleCount / petalCount);
    
    for (let i = 0; i < petalCount; i++) {
        const baseAngle = (i / petalCount) * Math.PI * 2;
        
        for (let j = 0; j < particlesPerPetal; j++) {
            // 在基础角度周围添加一些随机偏移，形成花瓣形状
            const angle = baseAngle + (Math.random() * 0.5 - 0.25);
            const distance = 0.5 + Math.random() * 0.5; // 粒子到中心的距离比例
            const speed = 1 + Math.random() * 3;
            const size = 1 + Math.random() * 2;
            
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed * distance,
                vy: Math.sin(angle) * speed * distance,
                color: color,
                alpha: 1,
                size: size,
                gravity: 0.03 + Math.random() * 0.03, // 降低重力，让花朵形状保持更久
                type: 1
            });
        }
    }
}

// 五角星形状烟花
function createStarFirework(x, y, color, particleCount) {
    const points = 5; // 五角星的点数
    const particlesPerPoint = Math.floor(particleCount / points);
    
    for (let i = 0; i < points; i++) {
        // 五角星的每个点
        const angle1 = (i / points) * Math.PI * 2;
        // 下一个点的角度
        const angle2 = ((i + 1) % points / points) * Math.PI * 2;
        
        for (let j = 0; j < particlesPerPoint; j++) {
            // 在两个角度之间创建粒子，形成星形的边
            const t = j / particlesPerPoint;
            const angle = angle1 * (1 - t) + angle2 * t;
            const distance = 0.8 + Math.random() * 0.4; // 粒子到中心的距离
            const speed = 1 + Math.random() * 2;
            
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed * distance,
                vy: Math.sin(angle) * speed * distance,
                color: color,
                alpha: 1,
                size: 1.5 + Math.random() * 1.5,
                gravity: 0.02 + Math.random() * 0.02, // 更低的重力
                type: 2
            });
        }
    }
}

// 爱心形状烟花
function createHeartFirework(x, y, color, particleCount) {
    for (let i = 0; i < particleCount; i++) {
        // 参数方程生成心形
        const t = Math.random() * Math.PI * 2;
        // 心形参数方程
        const heartX = 16 * Math.pow(Math.sin(t), 3);
        const heartY = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        
        // 缩放和反转Y轴（因为在屏幕坐标系中Y轴向下）
        const scale = 0.03 + Math.random() * 0.02;
        const angle = Math.atan2(-heartY, heartX); // 计算粒子运动方向
        const distance = Math.sqrt(heartX*heartX + heartY*heartY);
        const speed = 1 + Math.random() * 2;
        
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed * scale * distance,
            vy: Math.sin(angle) * speed * scale * distance,
            color: color,
            alpha: 1,
            size: 1.5 + Math.random() * 1.5,
            gravity: 0.01 + Math.random() * 0.02, // 更低的重力
            type: 3
        });
    }
}

function updateFireworks() {
    // 更新上升的烟花
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        
        // 更新位置
        if (!fw.exploded) {
            // 记录尾迹
            fw.trail.push({x: fw.x, y: fw.y});
            if (fw.trail.length > fw.trailLength) {
                fw.trail.shift();
            }
            
            // 移动烟花
            fw.y -= fw.speed;
            
            // 到达目标高度，爆炸
            if (fw.y <= fw.targetY) {
                createFireworks(fw.x, fw.y, fw.color, fw.type);
                fw.exploded = true;
            }
        } else {
            // 爆炸后移除
            fireworks.splice(i, 1);
        }
    }
    
    // 更新爆炸粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= 0.01;
        
        // 如果粒子消失，从数组中移除
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawFireworks() {
    fwCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    
    // 绘制上升的烟花
    for (let i = 0; i < fireworks.length; i++) {
        const fw = fireworks[i];
        
        if (!fw.exploded) {
            // 绘制尾迹
            for (let j = 0; j < fw.trail.length; j++) {
                const alpha = j / fw.trail.length; // 尾迹透明度
                fwCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                fwCtx.beginPath();
                fwCtx.arc(fw.trail[j].x, fw.trail[j].y, fw.size * (1 - j / fw.trail.length), 0, Math.PI * 2);
                fwCtx.fill();
            }
            
            // 绘制烟花头部
            fwCtx.fillStyle = fw.color;
            fwCtx.shadowBlur = 10;
            fwCtx.shadowColor = fw.color;
            fwCtx.beginPath();
            fwCtx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
            fwCtx.fill();
        }
    }
    
    // 绘制爆炸粒子
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        fwCtx.globalAlpha = p.alpha;
        fwCtx.fillStyle = p.color;
        fwCtx.shadowBlur = 10;
        fwCtx.shadowColor = p.color;
        
        // 根据粒子类型绘制不同形状
        switch(p.type) {
            case 0: // 普通圆形粒子
                fwCtx.beginPath();
                fwCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                fwCtx.fill();
                break;
                
            case 1: // 花朵形状的粒子
                drawFlowerParticle(p);
                break;
                
            case 2: // 五角星形状的粒子
                drawStarParticle(p);
                break;
                
            case 3: // 爱心形状的粒子
                drawHeartParticle(p);
                break;
        }
    }
    
    fwCtx.globalAlpha = 1;
    fwCtx.shadowBlur = 0;
}

function drawFlowerParticle(p) {
    const petalCount = 5;
    const petalSize = p.size * 1.5;
    
    fwCtx.beginPath();
    // 绘制中心圆
    fwCtx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
    fwCtx.fill();
    
    // 绘制花瓣
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petalX = p.x + Math.cos(angle) * petalSize;
        const petalY = p.y + Math.sin(angle) * petalSize;
        
        fwCtx.beginPath();
        fwCtx.arc(petalX, petalY, p.size, 0, Math.PI * 2);
        fwCtx.fill();
    }
}

// 绘制五角星形状的粒子
function drawStarParticle(p) {
    const points = 5;
    const outerRadius = p.size * 2;
    const innerRadius = p.size * 0.8;
    
    fwCtx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i / (points * 2)) * Math.PI * 2;
        const x = p.x + Math.cos(angle) * radius;
        const y = p.y + Math.sin(angle) * radius;
        
        if (i === 0) {
            fwCtx.moveTo(x, y);
        } else {
            fwCtx.lineTo(x, y);
        }
    }
    fwCtx.closePath();
    fwCtx.fill();
}

// 绘制爱心形状的粒子
function drawHeartParticle(p) {
    const size = p.size * 2;
    
    fwCtx.beginPath();
    // 绘制爱心
    fwCtx.moveTo(p.x, p.y + size * 0.3);
    // 左半部分
    fwCtx.bezierCurveTo(
        p.x, p.y, 
        p.x - size, p.y, 
        p.x - size, p.y - size * 0.5
    );
    fwCtx.bezierCurveTo(
        p.x - size, p.y - size * 1.1, 
        p.x - size * 0.5, p.y - size * 1.2, 
        p.x, p.y - size * 0.7
    );
    // 右半部分
    fwCtx.bezierCurveTo(
        p.x + size * 0.5, p.y - size * 1.2, 
        p.x + size, p.y - size * 1.1, 
        p.x + size, p.y - size * 0.5
    );
    fwCtx.bezierCurveTo(
        p.x + size, p.y, 
        p.x, p.y, 
        p.x, p.y + size * 0.3
    );
    fwCtx.closePath();
    fwCtx.fill();
}

// 动画循环
function startAnimations() {
    console.log('启动动画循环');
    animationStarted = true;
    
    // 背景动画
    function animateBackground() {
        drawBackground();
        requestAnimationFrame(animateBackground);
    }
    
    // 可视化动画
    function animateVisualizer() {
        drawSoundWave();
        requestAnimationFrame(animateVisualizer);
    }
    
    // 烟花动画
    function animateFireworks() {
        updateFireworks();
        drawFireworks();
        requestAnimationFrame(animateFireworks);
    }
    
    // 启动所有动画循环
    animateBackground();
    animateVisualizer();
    animateFireworks();
    
    console.log("所有动画循环已启动");
} 
