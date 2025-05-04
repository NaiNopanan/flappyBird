import React, { useEffect, useRef } from 'react';

class GameObject {
    x = 0;
    y = 0;
    prevX = 0;
    prevY = 0;
    width = 50;
    height = 50;
    scale = 1;
    visible = true;
    tag?: string; // 🏷️ New

    update(_dt: number, _scene: Scene) {
        this.prevX = this.x;
        this.prevY = this.y;
    }


    render(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.fillStyle = 'gray';
        ctx.fillRect(interpX, interpY, this.width, this.height);
        ctx.restore();
    }
    debugRender?(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number): void;

}


class Bird extends GameObject {
    velocityY = 0;
    gravity = 0.5;
    jumpStrength = -10;
    score = 0;
    lives = 3; // ✅ เพิ่มจำนวนหัวใจเริ่มต้น
    invincibleUntil = 0;

    constructor() {
        super();
        this.x = 100;
        this.y = 100;
        this.width = 40;
        this.height = 40;
        this.tag = 'bird'; // ✅ สำคัญ
    }

    update(dt: number, scene: Scene) {
        this.prevX = this.x;
        this.prevY = this.y;

        this.velocityY += this.gravity;
        this.y += this.velocityY;

        const now = performance.now();

        const pipes = scene.getByTag('pipe') as Pipe[];
        for (const pipe of pipes) {
            if (this.checkCollision(pipe)) {
                if (now > this.invincibleUntil) {
                    if (this.lives > 0) {
                        this.lives--;
                        this.invincibleUntil = now + 1000; // ⏱️ 1 วินาทีอมตะ
                        console.log("💥 Hit! Lives left:", this.lives);
                    } else {
                        console.log("☠️ Game Over!");
                    }
                }
            }

            if (!pipe.passed && pipe.x + pipe.width < this.x) {
                pipe.passed = true;
                this.score++;
            }
        }
    }



    checkCollision(pipe: Pipe): boolean {
        const birdBottom = this.y + this.height;
        const birdRight = this.x + this.width;

        const hitTop = this.y < pipe.gapHeight && this.x + this.width > pipe.x && this.x < pipe.x + pipe.width;
        const hitBottom = birdBottom > pipe.gapHeight + pipe.gapSize && this.x + this.width > pipe.x && this.x < pipe.x + pipe.width;

        return hitTop || hitBottom;
    }

    jump() {
        this.velocityY = this.jumpStrength;
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.fillStyle = 'orange';
        ctx.fillRect(interpX, interpY, this.width, this.height);
        ctx.restore();
    }

    debugRender(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(interpX, interpY, this.width, this.height);
        ctx.restore();
    }
}

class Pipe extends GameObject {
    gapHeight: number;
    gapSize: number;
    speed: number;
    passed = false;


    constructor(x: number, gapTop: number, gapSize: number, speed: number) {
        super();
        this.x = x;
        this.y = 0;
        this.prevX = x;
        this.prevY = 0;
        this.width = 60;
        this.height = 0; // ไม่ใช้
        this.gapHeight = gapTop;
        this.gapSize = gapSize;
        this.speed = speed;
    }

    isOffscreen(viewLeft: number): boolean {
        return this.x + this.width < viewLeft;
    }

    update(dt: number, scene: Scene) {
        this.prevX = this.x;
        this.x -= this.speed * dt;

        // ลบทิ้งเมื่อหลุดจอซ้าย
        if (this.isOffscreen(scene.camera?.x ?? 0)) {
            scene.remove(this);
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const x = this.prevX + (this.x - this.prevX) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.fillStyle = 'green';

        // ท่อบน
        ctx.fillRect(x, 0, this.width, this.gapHeight);

        // ท่อล่าง
        const bottomY = this.gapHeight + this.gapSize;
        ctx.fillRect(x, bottomY, this.width, 1000);

        ctx.restore();
    }

    debugRender(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const x = this.prevX + (this.x - this.prevX) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;

        // ขอบ hitbox บน
        ctx.strokeRect(x, 0, this.width, this.gapHeight);

        // ขอบ hitbox ล่าง
        const bottomY = this.gapHeight + this.gapSize;
        ctx.strokeRect(x, bottomY, this.width, 1000);

        ctx.restore();
    }
}

class Heart extends GameObject {
    constructor(x: number, y: number) {
        super();
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
    }

    update(dt: number, scene: Scene) {
        this.prevX = this.x;
        this.x -= 100 * dt;

        // ลบถ้าออกนอกจอ
        if (this.x + this.width < (scene.camera?.x ?? 0)) {
            scene.remove(this);
        }

        // ตรวจสอบการเก็บ
        const bird = scene.getByTag("bird")[0] as Bird;
        if (bird && this.checkCollect(bird)) {
            scene.remove(this);
            if (bird.lives < 3) bird.lives++;
            console.log("💖 Collected!");
        }
    }

    checkCollect(bird: Bird): boolean {
        return (
            this.x < bird.x + bird.width &&
            this.x + this.width > bird.x &&
            this.y < bird.y + bird.height &&
            this.y + this.height > bird.y
        );
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        const interpX = this.prevX + (this.x - this.prevX) * alpha;
        const interpY = this.prevY + (this.y - this.prevY) * alpha;

        ctx.save();
        camera.applyTransform(ctx);
        ctx.fillStyle = 'pink';
        ctx.beginPath();
        ctx.arc(interpX + 10, interpY + 10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}



class Scene {
    objects: GameObject[] = [];
    camera?: Camera;

    add(obj: GameObject) {
        this.objects.push(obj);
    }

    update(dt: number, camera: Camera) {
        this.objects = this.objects.filter(obj => {
            obj.update(dt, this); // ✅ ส่ง scene เข้า
            return true; // ลบโดย object เองผ่าน scene.remove()
        });
    }



    render(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        this.objects.forEach(obj => {
            if (obj.visible) obj.render(ctx, camera, alpha);
        });
    }

    debugRender(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number) {
        this.objects.forEach(obj => obj.debugRender?.(ctx, camera, alpha));
    }

    getByTag(tag: string): GameObject[] {
        return this.objects.filter(obj => obj.tag === tag);
    }

    remove(obj: GameObject) {
        this.objects = this.objects.filter(o => o !== obj);
    }

    applyScaleToAll(scale: number) {
        this.objects.forEach(obj => obj.scale = scale);
    }

}

class Camera {
    x = 0;
    y = 0;
    scale = 1;

    applyTransform(ctx: CanvasRenderingContext2D) {
        ctx.setTransform(this.scale, 0, 0, this.scale, -this.x * this.scale, -this.y * this.scale);
    }
}

function computeScaleFromHeight(height: number): number {
    const minHeight = 540;
    const maxHeight = 1080;
    const minScale = 0.5;
    const maxScale = 1;

    if (height <= minHeight) return minScale;
    if (height >= maxHeight) return maxScale;

    const t = (height - minHeight) / (maxHeight - minHeight);
    return minScale + t * (maxScale - minScale);
}



const HrGame2: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef(new Scene());
    const cameraRef = useRef(new Camera());
    const lastTimeRef = useRef(performance.now());

    const birdRef = useRef<Bird | null>(null);
    const PHYSICS_TICK = 1000 / 30;
    let accumulator = 0;

    const handleResize = () => {
        const canvas = canvasRef.current!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const newScale = computeScaleFromHeight(window.innerHeight);
        const camera = cameraRef.current;
        const scene = sceneRef.current;

        camera.scale = newScale;
        scene.applyScaleToAll(newScale); // ✅ broadcast scale ไปทุก object
    };



    useEffect(() => {
        window.addEventListener('resize', handleResize);
        handleResize(); // เรียกทันที

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;


        // ✅ สร้าง Bird แค่ครั้งเดียว
        if (!birdRef.current) {
            const bird = new Bird();
            birdRef.current = bird;
            sceneRef.current.add(bird);
        }

        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                birdRef.current?.jump(); // ✅ ใช้จาก ref
            }
        };
        window.addEventListener('keydown', handleKey);

        canvas.addEventListener('click', () => {
            birdRef.current?.jump();
        });

        let lastTime = performance.now();

        const loop = (time: number) => {
            const dt = time - lastTime;
            lastTime = time;
            accumulator += dt;

            while (accumulator >= PHYSICS_TICK) {
                sceneRef.current.update(PHYSICS_TICK / 1000, cameraRef.current); // ✅ ส่ง camera เข้า

                accumulator -= PHYSICS_TICK;
            }

            const alpha = accumulator / PHYSICS_TICK;

            const ctx = canvasRef.current!.getContext("2d")!;
            const canvas = canvasRef.current!;
            const bird = birdRef.current!;
            const camera = cameraRef.current;
            const scale = camera.scale;

            const viewCenterX = canvas.width / (2 * scale);
            camera.x = bird.x - viewCenterX + bird.width / 2;
            camera.y = 0;

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            camera.applyTransform(ctx);

            sceneRef.current.render(ctx, camera, alpha);
            sceneRef.current.debugRender(ctx, camera, alpha);

            // หลังจาก render scene
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = 'white';
            ctx.font = '32px sans-serif';
            ctx.fillText(`Score: ${bird.score}`, 20, 40);

            // แสดงหัวใจ
            for (let i = 0; i < bird.lives; i++) {
                ctx.fillStyle = 'red';
                const size = 24;
                ctx.beginPath();
                ctx.arc(30 + i * (size + 10), 70, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);

        setInterval(() => {
            const camera = cameraRef.current;
            const canvas = canvasRef.current;
            const scene = sceneRef.current;

            if (!camera || !canvas || !scene) return; // ✅ ป้องกัน undefined

            const pipes = scene.getByTag('pipe');
            const spawnThreshold = 300;

            const spawnX = camera.x + canvas.width / camera.scale + 100;

            const hasNearbyPipe = pipes.some(p => Math.abs(p.x - spawnX) < spawnThreshold);
            if (hasNearbyPipe) return;

            const gapSize = 150;
            const minTop = 50;
            const maxTop = canvas.height / camera.scale - gapSize - 50;
            const gapTop = Math.random() * (maxTop - minTop) + minTop;

            const pipe = new Pipe(spawnX, gapTop, gapSize, 100);
            pipe.tag = 'pipe';
            scene.add(pipe);

            // 🔁 30% โอกาสสร้างหัวใจ
            if (Math.random() < 0.3) {
                const heart = new Heart(spawnX + pipe.width / 2 - 10, gapTop + gapSize / 2 - 10); // << อยู่กลาง gap
                heart.tag = 'heart';
                scene.add(heart);
            }

        }, 2000);

        return () => {
            window.removeEventListener('keydown', handleKey);
        };


    }, []);


    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100vw',
                height: '100vh',
                display: 'block',
                background: '#87CEEB',
            }}
        />
    );
};

export default HrGame2;
