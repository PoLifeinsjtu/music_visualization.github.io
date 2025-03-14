function createFireworks(x, y, color) {
    const particleCount = 150 + Math.floor(Math.random() * 100); // 150-250个粒子
    shapeType = Math.floor(Math.random() * 10); // 随机选择形状类型
    if (shapeType >= 4) { shapeType = 0; } // 原始散开形状

    // 创建爆炸粒子
    for (let i = 0; i < particleCount; i++) {
        let angle, speed, size;

        switch (shapeType) {
            case 0: // 原始散开形状
                angle = Math.random() * Math.PI * 2;
                speed = 1 + Math.random() * 3;
                size = 1 + Math.random() * 2;
                break;
            case 1: // 花形
                angle = (i / particleCount) * Math.PI * 2;
                speed = 2 + Math.random() * 2;
                size = 1 + Math.random() * 2;
                break;
            case 2: // 爱心形
                angle = (i / particleCount) * Math.PI * 2;
                speed = 2 + Math.random() * 2;
                size = 1 + Math.random() * 2;
                x += 16 * Math.pow(Math.sin(angle), 3);
                y -= 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
                break;
            case 3: // 五角星形
                angle = (i / particleCount) * Math.PI * 2;
                speed = 2 + Math.random() * 2;
                size = 1 + Math.random() * 2;
                x += Math.cos(angle) * (5 + 5 * Math.cos(5 * angle));
                y += Math.sin(angle) * (5 + 5 * Math.cos(5 * angle));
                break;
        }

        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            alpha: 1,
            size: size,
            gravity: 0.05 + Math.random() * 0.05
        });
    }

    console.log("烟花爆炸:", x, y, "粒子数:", particleCount, "形状类型:", shapeType);
}
