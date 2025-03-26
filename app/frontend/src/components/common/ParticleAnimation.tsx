import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    size: number;
    color: string;
    speedX: number;
    speedY: number;
}

export const ParticleAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesArray = useRef<Particle[]>([]);

    const initParticles = (canvas: HTMLCanvasElement) => {
        particlesArray.current = [];
        for (let i = 0; i < 100; i++) {
            const size = Math.random() * 5 + 1;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const speedX = (Math.random() - 0.5) * 1;
            const speedY = (Math.random() - 0.5) * 1;
            const color = "rgba(0, 212, 255, 0.7)";
            particlesArray.current.push({ x, y, size, color, speedX, speedY });
        }
    };

    const animateParticles = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particlesArray.current.forEach(particle => {
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            if (particle.size > 0.2) particle.size -= 0.02;

            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(() => animateParticles(canvas, ctx));
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        initParticles(canvas);
        animateParticles(canvas, ctx);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
            }}
        />
    );
}; 