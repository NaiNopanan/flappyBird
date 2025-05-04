import React, {useEffect, useRef, useState} from 'react';
import birdImage from './sprites/bear.png'; // ปรับ path ให้ถูกต้อง
import pipeHead from './sprites/pipe-head.png'; // ปรับ path ให้ถูกต้อง
import pipeBody from './sprites/pipe-body.png'; // ปรับ path ให้ถูกต้อง
import cloudImage from './sprites/cloud.png'; // ปรับ path ให้ถูกต้อง
import mountain from './sprites/mountain.jpg'; // ปรับ path ให้ถูกต้อง
import city from './sprites/city.png'; // ปรับ path ให้ถูกต้อง
import heart from './sprites/heart.png'; // ปรับ path ให้ถูกต้อง


const GRAVITY = 0.98;
const PHYSICS_TICK = 1000 / 30; // 60 FPS

const INITIAL_PIPE_SPEED = 5;
const INITIAL_PIPE_WIDTH = 80;
const INITIAL_PIPE_GAP = 250;
const BASE_PIPE_INTERVAL = 8000;

const JUMP_BASE = -10;
const JUMP_GROWTH = -2;
const MAX_JUMP_VELOCITY = -25;
const JUMP_COMBO_RESET_TIME = 300;

// 🔁 ใส่ path รูปนกของคุณที่นี่
const BIRD_SPRITE_SRC = birdImage;
const BIRD_FRAME_WIDTH = 256;     // หรือ Math.floor(1024 / 3)
const BIRD_FRAME_HEIGHT = 256;
const BIRD_TOTAL_FRAMES = 3;
const BIRD_ANIMATION_INTERVAL = 100;

type Pipe = {
    x: number;
    prevX: number;
    gapTop: number;
    gapHeight: number;
    passed: boolean;
    hit?: boolean; // 👈 เพิ่ม flag นี้
};

type Item = {
    x: number;
    prevX: number;
    y: number;
    type: 'heart';
    collected: boolean;
};



type CloudLayer = {
    image: HTMLImageElement;
    speed: number;
    offset: number;
};

type Cloud = {
    image: HTMLImageElement;
    x: number;
    y: number;
    speed: number;
    width: number;
    height: number;
};


const HrGame2: React.FC = () => {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const velocity = useRef(0);
    const birdY = useRef(200);
    const prevBirdY = useRef(200);
    const birdX = useRef(0);

    const canvasSize = useRef({ width: window.innerWidth, height: window.innerHeight });

    const pipes = useRef<Pipe[]>([]);
    const lastPipeTime = useRef(performance.now());
    const lastPhysicsTime = useRef(performance.now());
    const isGameOver = useRef(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const score = useRef(0);

    const items = useRef<Item[]>([]);


    const difficulty = useRef(1);
    const gameStartTime = useRef(performance.now());

    const jumpComboCount = useRef(0);
    const lastJumpTime = useRef(0);

    // 🐦 Sprite
    const birdImage = useRef<HTMLImageElement | null>(null);
    const birdFrame = useRef(0);
    const blinkUntil = useRef(0);


    useEffect(() => {
        const img = new Image();
        img.src = BIRD_SPRITE_SRC;

        // รอโหลดก่อนถึงจะใช้
        img.onload = () => {
            birdImage.current = img;
        };

        img.onerror = () => {
            console.error("❌ โหลด sprite นกไม่สำเร็จ:", BIRD_SPRITE_SRC);
        };

        const interval = setInterval(() => {
            birdFrame.current = (birdFrame.current + 1) % BIRD_TOTAL_FRAMES;
        }, BIRD_ANIMATION_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const pipeImage = useRef<HTMLImageElement | null>(null);
    const pipeHeadImage = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.src = pipeBody;
        img.onload = () => {
            pipeImage.current = img;
        };

        const headImg = new Image();
        headImg.src = pipeHead;
        headImg.onload = () => {
            pipeHeadImage.current = headImg;
        };
    }, []);

    const clouds = useRef<Cloud[]>([]);

    const MIN_CLOUD_DISTANCE = 600; // px
    const MAX_ATTEMPTS = 10; // ป้องกันลูปไม่จบ

    useEffect(() => {
        const sources = [
            { src: cloudImage, speed: 0.4, scale: 0.2 }, // กลาง
            { src: cloudImage, speed: 0.6, scale: 0.4 }, // ใกล้
        ];

        Promise.all(
            sources.map(source => {
                return new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.src = source.src;
                    img.onload = () => resolve(img);
                });
            })
        ).then(images => {
            const newClouds: Cloud[] = [];
            const cloudCount = 8;

            for (let i = 0; i < cloudCount; i++) {
                let attempt = 0;
                let added = false;

                while (attempt < MAX_ATTEMPTS && !added) {
                    const index = Math.floor(Math.random() * images.length);
                    const img = images[index];
                    const baseScale = sources[index].scale;
                    const randScale = 0.8 + Math.random() * 0.4;

                    const width = img.width * baseScale * randScale;
                    const height = img.height * baseScale * randScale;
                    const x = Math.random() * canvasSize.current.width;

                    const tooClose = newClouds.some(c => Math.abs(c.x - x) < MIN_CLOUD_DISTANCE);
                    if (!tooClose) {
                        newClouds.push({
                            image: img,
                            x,
                            y: Math.random() * 200,
                            speed: sources[index].speed,
                            width,
                            height,
                        });
                        added = true;
                    }

                    attempt++;
                }

                // ถ้าหาไม่ได้ใน 10 ครั้ง เราจะไม่เพิ่ม cloud ใหม่
            }

            clouds.current = newClouds;
        });

    }, []);


    const mountainImage = useRef<HTMLImageElement | null>(null);
    const mountainOffset = useRef(0);
    useEffect(() => {
        const img = new Image();
        img.src = mountain; // << ใช้ภาพต่อได้
        img.onload = () => {
            mountainImage.current = img;
        };
    }, []);


    const cityImage = useRef<HTMLImageElement | null>(null);
    const cityOffset = useRef(0);

    useEffect(() => {
        const img = new Image();
        img.src = city; // 🔁 path ที่ได้จากภาพ city
        img.onload = () => {
            cityImage.current = img;
        };
    }, []);


    const lives = useRef(3);
    const heartImage = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.src = heart;
        img.onload = () => {
            heartImage.current = img;
        };
    }, []);

    const scale = useRef(1);

    const computeScale = (height: number) => {
        const minHeight = 520;
        const maxHeight = 1080;
        const minScale = 0.5;
        const maxScale = 1;

        if (height <= minHeight) return minScale;
        if (height >= maxHeight) return maxScale;

        return minScale + ((height - minHeight) / (maxHeight - minHeight)) * (maxScale - minScale);
    };


    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvasSize.current = {
                width: window.innerWidth,
                height: window.innerHeight,
            };
            canvas.width = canvasSize.current.width * dpr;
            canvas.height = canvasSize.current.height * dpr;
            canvas.style.width = `${canvasSize.current.width}px`;
            canvas.style.height = `${canvasSize.current.height}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            birdX.current = canvasSize.current.width / 2;

            scale.current = computeScale(window.innerHeight);
        };

        resize();
        window.addEventListener('resize', resize);

        /* 🔥 เพิ่ม “ท่อแรก” ทันทีหลัง resize (หรือจะใส่ก่อนก็ได้) */
        const spawnInitialPipe = () => {
            const gapTop = Math.random() * (canvasSize.current.height - INITIAL_PIPE_GAP - 100) + 50;

            if (pipes.current.length === 0) {
                pipes.current.push({
                    x: canvasSize.current.width,          // เริ่มที่ขอบขวา
                    prevX: canvasSize.current.width,
                    gapTop,
                    gapHeight: INITIAL_PIPE_GAP,
                    passed: false,
                });

                lastPipeTime.current = performance.now(); // รีเซ็ตเวลา เพื่อเริ่มนับ interval ใหม่
            }

        };
        spawnInitialPipe();   // <<< เรียกทันที

        const updateDifficulty = () => {
            const elapsed = (performance.now() - gameStartTime.current) / 1000;
            const newLevel = Math.floor(elapsed / 10) + 1;
            if (newLevel > difficulty.current) {
                difficulty.current = newLevel;
            }
        };

        const physicsInterval = setInterval(() => {
            if (isGameOver.current) return;

            const now = performance.now();
            lastPhysicsTime.current = now;
            prevBirdY.current = birdY.current;

            updateDifficulty();

            const currentPipeSpeed = INITIAL_PIPE_SPEED + (difficulty.current - 1);
            const baseGap = INITIAL_PIPE_GAP - (difficulty.current - 1) * 10;
            const scaledGap = Math.max(baseGap * scale.current, 60); // กำหนด gap ขั้นต่ำ เช่น 60px

            const currentPipeInterval = BASE_PIPE_INTERVAL / difficulty.current;

            const scaledGravity = GRAVITY * scale.current;
            velocity.current += scaledGravity;
            birdY.current += velocity.current;

            if (now - lastPipeTime.current > currentPipeInterval) {
                const gapTop = Math.random() * (canvasSize.current.height - scaledGap - 100) + 50;

                const newPipe: Pipe = {
                    x: canvasSize.current.width,
                    prevX: canvasSize.current.width,
                    gapTop,
                    gapHeight: scaledGap,
                    passed: false,
                };

                pipes.current.push(newPipe);
                lastPipeTime.current = now;

                // 🎁 Spawn ไอเทมแบบสุ่ม (30% โอกาส)
                if (Math.random() < 0.3) {
                    const heartY = gapTop + scaledGap / 2;
                    items.current.push({
                        x: newPipe.x + INITIAL_PIPE_WIDTH / 2,
                        prevX: newPipe.x + INITIAL_PIPE_WIDTH / 2,
                        y: heartY,
                        type: 'heart',
                        collected: false,
                    });
                }
            }


            pipes.current = pipes.current
                .map(pipe => {
                    if (!pipe.passed && birdX.current > pipe.x + INITIAL_PIPE_WIDTH)
                    {
                        pipe.passed = true;
                        score.current += 1;
                    }

                    return {
                        ...pipe,
                        prevX: pipe.x,
                        x: pipe.x - currentPipeSpeed,
                    };
                })
                .filter(pipe => pipe.x + INITIAL_PIPE_WIDTH > 0);

            items.current = items.current
                .map(item => {
                    const currentPipeSpeed = INITIAL_PIPE_SPEED + (difficulty.current - 1);
                    return {
                        ...item,
                        prevX: item.x,
                        x: item.x - currentPipeSpeed,
                    };
                })
                .filter(item => !item.collected && item.x > -50);



            for (const pipe of pipes.current) {
                const withinX = birdX.current + 20 > pipe.x && birdX.current - 20 < pipe.x + INITIAL_PIPE_WIDTH;
                const outsideGap = birdY.current - 20 < pipe.gapTop || birdY.current + 20 > pipe.gapTop + pipe.gapHeight;

                if (withinX && outsideGap && !pipe.hit) {
                    pipe.hit = true;

                    if (lives.current > 0) {
                        lives.current -= 1;
                        velocity.current = 0;

                        blinkUntil.current = performance.now() + 1000; // ✨ กระพริบ 1 วิ
                        return;
                    } else {
                        isGameOver.current = true;
                    }
                }

            }

            for (const item of items.current) {
                const dx = item.x - birdX.current;
                const dy = item.y - birdY.current;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 100 && !item.collected) {
                    item.collected = true;
                    if (item.type === 'heart' && lives.current < 3) {
                        lives.current += 1;
                    }
                }
            }


            if (birdY.current > canvasSize.current.height - 20) {
                birdY.current = canvasSize.current.height - 20;
                velocity.current = 0;
                isGameOver.current = true;
                setShowGameOver(true);
            }

        }, PHYSICS_TICK);

        const renderLoop = () => {
            const { width, height } = canvasSize.current;
            const now = performance.now();
            const alpha = Math.min((now - lastPhysicsTime.current) / PHYSICS_TICK, 1);
            const interpolatedY = prevBirdY.current + (birdY.current - prevBirdY.current) * alpha;

            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = 'green';


            if (mountainImage.current) {
                const img = mountainImage.current;
                const speed = 0.1;

                mountainOffset.current = (mountainOffset.current - speed) % img.width;
                const offset = Math.floor(mountainOffset.current); // << ปัดค่าให้เป็นจำนวนเต็ม
                const y = canvasSize.current.height - img.height;

                const imgCount = Math.ceil(canvasSize.current.width / img.width) + 2;

                for (let i = 0; i < imgCount; i++) {
                    const drawX = Math.floor(offset + i * img.width); // << ปัดตำแหน่งที่วาดด้วย
                    ctx.drawImage(img, drawX, y, img.width, img.height);
                }
            }


            if (cityImage.current) {
                const img = cityImage.current;
                const y = canvasSize.current.height - img.height;

                const speed = 0.3;
                cityOffset.current = (cityOffset.current - speed) % img.width;
                const offset = Math.floor(cityOffset.current);

                const imgCount = Math.ceil(canvasSize.current.width / img.width) + 2;

                for (let i = 0; i < imgCount; i++) {
                    const drawX = Math.floor(offset + i * img.width);
                    ctx.drawImage(img, drawX, y, img.width, img.height);
                }
            }

            clouds.current
                .slice() // clone เพื่อไม่แก้ array ต้นฉบับ
                .sort((a, b) => a.speed - b.speed) // speed น้อย = ไกล → วาดก่อน
                .forEach(cloud => {
                    cloud.x -= cloud.speed;
                    if (cloud.x + cloud.width < 0) {
                        cloud.x = canvasSize.current.width + Math.random() * 200;
                        cloud.y = Math.random() * 200;
                    }
                    ctx.drawImage(cloud.image, cloud.x, cloud.y, cloud.width, cloud.height);
                });


            pipes.current.forEach(pipe => {
                pipes.current.forEach(pipe => {
                    const interpolatedX = pipe.prevX + (pipe.x - pipe.prevX) * alpha;

                    const pipeWidth = INITIAL_PIPE_WIDTH * scale.current;
                    const pipeTopHeight = pipe.gapTop;
                    const pipeBottomY = pipe.gapTop + pipe.gapHeight;
                    const pipeBottomHeight = height - pipeBottomY;

                    const pipeHeadHeight = 30 * scale.current;

                    if (pipeImage.current && pipeHeadImage.current) {
                        // 🟢 วาดท่อบน (body)
                        ctx.drawImage(
                            pipeImage.current,
                            interpolatedX,
                            0,
                            pipeWidth,
                            pipeTopHeight - pipeHeadHeight
                        );

                        // 🟢 วาดหัวท่อบน (กลับหัว)
                        ctx.save();
                        ctx.translate(interpolatedX + pipeWidth / 2, pipeTopHeight - pipeHeadHeight / 2);
                        ctx.rotate(Math.PI); // หมุนกลับหัว
                        ctx.drawImage(
                            pipeHeadImage.current,
                            -pipeWidth / 2,
                            -pipeHeadHeight / 2,
                            pipeWidth,
                            pipeHeadHeight
                        );
                        ctx.restore();

                        // 🟢 วาดท่อล่าง (body)
                        ctx.drawImage(
                            pipeImage.current,
                            interpolatedX,
                            pipeBottomY + pipeHeadHeight,
                            pipeWidth,
                            pipeBottomHeight - pipeHeadHeight
                        );

                        // 🟢 วาดหัวท่อล่าง (ไม่หมุน)
                        ctx.drawImage(
                            pipeHeadImage.current,
                            interpolatedX,
                            pipeBottomY,
                            pipeWidth,
                            pipeHeadHeight
                        );

                    } else {
                        // fallback debug
                        ctx.fillStyle = 'green';
                        ctx.fillRect(interpolatedX, 0, pipeWidth, pipeTopHeight);
                        ctx.fillRect(interpolatedX, pipeBottomY, pipeWidth, pipeBottomHeight);
                    }
                });

            });


            items.current.forEach(item => {
                if (item.collected) return;

                const interpolatedX = item.prevX + (item.x - item.prevX) * alpha;

                // 🕒 เวลาที่ใช้สำหรับ animation
                const pulseTime = now / 40 + item.x * 0.01; // เพิ่ม item.x เพื่อให้ไม่เต้นพร้อมกันทั้งหมด
                const scale = 1 + 0.1 * Math.sin(pulseTime); // scale จะอยู่ระหว่าง ~0.9 - 1.1

                const size = 100 * scale;
                const drawX = interpolatedX - size / 2;
                const drawY = item.y - size / 2;

                ctx.save();
                ctx.globalAlpha = 1;

                if (item.type === 'heart' && heartImage.current) {
                    ctx.drawImage(heartImage.current, drawX, drawY, size, size);
                }

                ctx.restore();
            });

            // 🐦 Draw sprite bird
            if (birdImage.current) {
                const drawWidth = BIRD_FRAME_WIDTH * scale.current;
                const drawHeight = BIRD_FRAME_HEIGHT * scale.current;

                // ✨ เริ่มกระพริบ
                const now = performance.now();
                const isBlinking = now < blinkUntil.current;
                if (isBlinking) {
                    const blinkCycle = Math.floor(now / 100) % 2; // สลับ 0 กับ 1 ทุก 100ms
                    ctx.globalAlpha = blinkCycle ? 0.2 : 1;
                }

                ctx.drawImage(
                    birdImage.current,
                    birdFrame.current * BIRD_FRAME_WIDTH, 0,
                    BIRD_FRAME_WIDTH,
                    BIRD_FRAME_HEIGHT,
                    birdX.current - drawWidth / 2,
                    interpolatedY - drawHeight / 2,
                    drawWidth,
                    drawHeight
                );
                ctx.globalAlpha = 1; // 🔄 รีเซ็ต
            }


            ctx.fillStyle = 'white';
            ctx.font = '32px sans-serif';
            ctx.fillText(`Score: ${score.current}`, 20, 50);

            ctx.font = '20px sans-serif';
            ctx.fillText(`Difficulty: ${difficulty.current}`, 20, 80);

            if (heartImage.current) {
                for (let i = 0; i < lives.current; i++) {
                    const baseX = 30 + i * 60;
                    const baseY = 120;

                    // 🕒 เวลาสำหรับ animation (เพิ่ม i * phase เพื่อไม่ให้เต้นพร้อมกัน)
                    const pulseTime = now / 300 + i * 0.8;
                    const scale = 1 + 0.1 * Math.sin(pulseTime);

                    const size = 60 * scale;
                    const drawX = baseX + (24 - size) / 2; // center alignment
                    const drawY = baseY + (24 - size) / 2;

                    ctx.save();
                    ctx.drawImage(heartImage.current, drawX, drawY, size, size);
                    ctx.restore();
                }
            }

            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);

        return () => {
            window.removeEventListener('resize', resize);
            clearInterval(physicsInterval);
        };
    }, []);

    const   handleJump = () => {
        if (isGameOver.current) return;

        const now = performance.now();

        if (now - lastJumpTime.current > JUMP_COMBO_RESET_TIME) {
            jumpComboCount.current = 0;
        }

        jumpComboCount.current++;
        lastJumpTime.current = now;

        let jumpVelocity = (JUMP_BASE + (jumpComboCount.current - 1) * JUMP_GROWTH) * scale.current;
        if (jumpVelocity < MAX_JUMP_VELOCITY * scale.current) {
            jumpVelocity = MAX_JUMP_VELOCITY * scale.current;
        }
        velocity.current = jumpVelocity;

    };


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                handleJump();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // useEffect(() => {
    //     const preventScroll = (e: TouchEvent) => {
    //         e.preventDefault();
    //     };
    //     document.body.addEventListener('touchmove', preventScroll, { passive: false });
    //
    //     return () => {
    //         document.body.removeEventListener('touchmove', preventScroll);
    //     };
    // }, []);

    const resetGame = () => {
        score.current = 0;
        lives.current = 3;
        velocity.current = 0;
        birdY.current = 200;
        prevBirdY.current = 200;
        pipes.current = [];
        items.current = [];
        isGameOver.current = false;
        difficulty.current = 1;
        gameStartTime.current = performance.now();
        lastPipeTime.current = performance.now();
        lastJumpTime.current = 0;
        jumpComboCount.current = 0;
        blinkUntil.current = 0;
        setShowGameOver(false);
    };



    return (
        <div
            onClick={handleJump}
            onTouchStart={handleJump}
            style={{
                outline: 'none',
                width: '100vw',
                height: '100vh',
                position: 'relative',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    touchAction: 'manipulation',
                }}
            />
            {showGameOver && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        padding: '40px',
                        borderRadius: '20px',
                        color: 'white',
                        textAlign: 'center',
                        fontFamily: 'sans-serif',
                        width: '500px',
                        zIndex: 10,
                    }}
                >
                    <h1 style={{margin: 0, fontSize: '48px'}}>เก่งมาก!</h1>
                    <p style={{marginTop: '10px', fontSize: '24px'}}>
                        คะแนนของคุณ: {score.current}
                    </p>
                    <button
                        onClick={resetGame}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            fontSize: '20px',
                            borderRadius: '12px',
                            backgroundColor: '#ffffff',
                            color: '#000',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        เล่นใหม่
                    </button>

                </div>
            )}
        </div>
    );

}

export default HrGame2;