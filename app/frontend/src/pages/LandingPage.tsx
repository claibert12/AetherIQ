import React, { useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  useToast,
} from '@chakra-ui/react';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  update: () => void;
  draw: () => void;
}

export const LandingPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const toast = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;

      constructor(x: number, y: number, size: number, color: string, speedX: number, speedY: number) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.speedX = speedX;
        this.speedY = speedY;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size > 0.2) this.size -= 0.02;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Initialize particles
    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < 100; i++) {
        const size = Math.random() * 5 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const speedX = (Math.random() - 0.5) * 1;
        const speedY = (Math.random() - 0.5) * 1;
        const color = "rgba(0, 212, 255, 0.7)";
        particlesRef.current.push(new Particle(x, y, size, color, speedX, speedY));
      }
    };

    // Animate particles
    const animateParticles = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach(particle => {
        particle.update();
        particle.draw();
      });
      requestAnimationFrame(animateParticles);
    };

    initParticles();
    animateParticles();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    
    if (email.includes("@") && email.includes(".")) {
      toast({
        title: "Success!",
        description: `You're in! Stay tuned, ${email}!`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      e.currentTarget.reset();
    } else {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box
      position="relative"
      minH="100vh"
      bg="#0a0a0a"
      color="white"
      overflow="hidden"
    >
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
      
      <Container maxW="600px" py="50px">
        <VStack
          spacing={6}
          p={10}
          bg="rgba(255, 255, 255, 0.05)"
          borderRadius="12px"
          backdropFilter="blur(10px)"
          boxShadow="0px 4px 15px rgba(0, 212, 255, 0.15)"
          animation="fadeIn 1s ease-out"
        >
          <Heading
            fontSize="2.8rem"
            fontWeight="bold"
            bgGradient="linear(to-r, #00d4ff, #0094ff)"
            bgClip="text"
            color="transparent"
          >
            AetherIQ
          </Heading>
          
          <Text fontSize="1.1rem" color="#bbb">
            The Future of AI-Powered Automation.
          </Text>

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <Input
              type="email"
              name="email"
              placeholder="Enter your email"
              required
              w="100%"
              p={3}
              mt={5}
              border="1px solid #555"
              borderRadius="6px"
              fontSize="1rem"
              bg="#111"
              color="white"
              _focus={{
                borderColor: "#00d4ff",
                boxShadow: "none",
              }}
              textAlign="center"
              transition="0.3s"
            />
            
            <Button
              type="submit"
              w="100%"
              mt={4}
              p={3}
              fontSize="1.2rem"
              bgGradient="linear(to-r, #00d4ff, #0094ff)"
              color="white"
              borderRadius="6px"
              _hover={{
                bgGradient: "linear(to-r, #0094ff, #00d4ff)",
                transform: "scale(1.05)",
              }}
              transition="0.3s ease-in-out"
            >
              Join the Future
            </Button>
          </form>
        </VStack>
      </Container>
    </Box>
  );
}; 