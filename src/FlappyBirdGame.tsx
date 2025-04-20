import React, { useEffect, useRef } from 'react';

const GRAVITY = 0.98;
const PHYSICS_TICK = 1000 / 30;

const INITIAL_PIPE_SPEED = 5;
const INITIAL_PIPE_WIDTH = 80;
const INITIAL_PIPE_GAP = 180;
const BASE_PIPE_INTERVAL = 4000;

const JUMP_BASE = -10;
const JUMP_GROWTH = -2;
const MAX_JUMP_VELOCITY = -25;
const JUMP_COMBO_RESET_TIME = 300;

// 🔁 ใส่ path รูปนกของคุณที่นี่
const BIRD_SPRITE_SRC = '/sprites/bird.png';
const BIRD_FRAME_WIDTH = 341;     // หรือ Math.floor(1024 / 3)
const BIRD_FRAME_HEIGHT = 1024;
const BIRD_TOTAL_FRAMES = 3;
const BIRD_ANIMATION_INTERVAL = 100;

type Pipe = {
    x: number;
    prevX: number;
    gapTop: number;
    gapHeight: number;
    passed: boolean;
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


const FlappyBirdGame: React.FC = () => {
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
    const score = useRef(0);

    const difficulty = useRef(1);
    const gameStartTime = useRef(performance.now());

    const jumpComboCount = useRef(0);
    const lastJumpTime = useRef(0);

    // 🐦 Sprite
    const birdImage = useRef<HTMLImageElement | null>(null);
    const birdFrame = useRef(0);

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
        img.src = '/sprites/pipe-body.png';
        img.onload = () => {
            pipeImage.current = img;
        };

        const headImg = new Image();
        headImg.src = '/sprites/pipe-head.png';
        headImg.onload = () => {
            pipeHeadImage.current = headImg;
        };
    }, []);

    const clouds = useRef<Cloud[]>([]);

    useEffect(() => {
        const sources = [
            { src: '/sprites/cloud.png', speed: 0.1, scale: 0.4 }, // ไกล
            { src: '/sprites/cloud.png', speed: 0.3, scale: 0.7 }, // กลาง
            { src: '/sprites/cloud.png', speed: 0.6, scale: 1.0 }, // ใกล้
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

            for (let i = 0; i < 15; i++) {
                const index = Math.floor(Math.random() * images.length);
                const img = images[index];
                const baseScale = sources[index].scale;
                const randScale = 0.8 + Math.random() * 0.4; // ปรับความหลากหลาย

                newClouds.push({
                    image: img,
                    x: Math.random() * canvasSize.current.width,
                    y: Math.random() * 200,
                    speed: sources[index].speed,
                    width: img.width * baseScale * randScale,
                    height: img.height * baseScale * randScale,
                });
            }

            clouds.current = newClouds;
        });

    }, []);

    const mountainImage = useRef<HTMLImageElement | null>(null);
    const mountainOffset = useRef(0);
    useEffect(() => {
        const img = new Image();
        img.src = '/sprites/mountain.png'; // << ใช้ภาพต่อได้
        img.onload = () => {
            mountainImage.current = img;
        };
    }, []);



    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        const resize = () => {
            canvasSize.current = { width: window.innerWidth, height: window.innerHeight };
            canvas.width = canvasSize.current.width;
            canvas.height = canvasSize.current.height;
            birdX.current = canvasSize.current.width / 2;

        };

        resize();
        window.addEventListener('resize', resize);

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
            const currentPipeGap = Math.max(INITIAL_PIPE_GAP - (difficulty.current - 1) * 10, 100);
            const currentPipeInterval = BASE_PIPE_INTERVAL / difficulty.current;

            velocity.current += GRAVITY;
            birdY.current += velocity.current;

            if (now - lastPipeTime.current > currentPipeInterval) {
                const gapTop = Math.random() * (canvasSize.current.height - currentPipeGap - 100) + 50;
                pipes.current.push({
                    x: canvasSize.current.width,
                    prevX: canvasSize.current.width,
                    gapTop,
                    gapHeight: currentPipeGap,
                    passed: false,
                });
                lastPipeTime.current = now;
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

            for (const pipe of pipes.current) {
                const withinX = birdX.current + 20 > pipe.x && birdX.current - 20 < pipe.x + INITIAL_PIPE_WIDTH;

                const outsideGap =
                    birdY.current - 20 < pipe.gapTop ||
                    birdY.current + 20 > pipe.gapTop + pipe.gapHeight;

                if (withinX && outsideGap) {
                    isGameOver.current = true;
                }
            }

            if (birdY.current > canvasSize.current.height - 20) {
                birdY.current = canvasSize.current.height - 20;
                velocity.current = 0;
                isGameOver.current = true;
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
            // pipes.current.forEach(pipe => {
            //     const interpolatedX = pipe.prevX + (pipe.x - pipe.prevX) * alpha;
            //
            //     ctx.fillRect(interpolatedX, 0, INITIAL_PIPE_WIDTH, pipe.gapTop);
            //     ctx.fillRect(
            //         interpolatedX,
            //         pipe.gapTop + pipe.gapHeight,
            //         INITIAL_PIPE_WIDTH,
            //         height - (pipe.gapTop + pipe.gapHeight)
            //     );
            // });

            clouds.current.forEach(cloud => {
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

                    const pipeWidth = INITIAL_PIPE_WIDTH;
                    const pipeTopHeight = pipe.gapTop;
                    const pipeBottomY = pipe.gapTop + pipe.gapHeight;
                    const pipeBottomHeight = height - pipeBottomY;

                    const pipeHeadHeight = 30; // <-- ปรับตามความสูงจริงของหัวท่อ

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



            // 🐦 Draw sprite bird
            if (birdImage.current) {
                const SCALE = 0.2; // ย่อให้เล็กลง
                const drawWidth = BIRD_FRAME_WIDTH * SCALE;   // 341 * 0.1 = 34.1
                const drawHeight = BIRD_FRAME_HEIGHT * SCALE; // 1024 * 0.1 = 102.4

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


            } else {
                // fallback วาดวงกลม
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(birdX.current, interpolatedY, 20, 0, Math.PI * 2);
                ctx.fill();
            }



            ctx.fillStyle = 'white';
            ctx.font = '32px sans-serif';
            ctx.fillText(`Score: ${score.current}`, 20, 50);

            ctx.font = '20px sans-serif';
            ctx.fillText(`Difficulty: ${difficulty.current}`, 20, 80);

            if (isGameOver.current) {
                ctx.fillStyle = 'white';
                ctx.font = '48px sans-serif';
                ctx.fillText('Game Over', width / 2 - 120, height / 2);
            }

            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);

        return () => {
            window.removeEventListener('resize', resize);
            clearInterval(physicsInterval);
        };
    }, []);

    const handleJump = () => {
        if (isGameOver.current) return;

        const now = performance.now();

        if (now - lastJumpTime.current > JUMP_COMBO_RESET_TIME) {
            jumpComboCount.current = 0;
        }

        jumpComboCount.current++;
        lastJumpTime.current = now;

        let jumpVelocity = JUMP_BASE + (jumpComboCount.current - 1) * JUMP_GROWTH;

        if (jumpVelocity < MAX_JUMP_VELOCITY) {
            jumpVelocity = MAX_JUMP_VELOCITY;
        }

        velocity.current = jumpVelocity;
    };

    return (
        <div onClick={handleJump}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
};

export default FlappyBirdGame;
