import React, { useRef, useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import RadialMenu from './RadialMenu';

interface CanvasProps {
  // Default values for our parameters
  settings: {
    layer1: {
      spacing: number;
      size: number;
      rotation: number;
      color: string;
    };
    layer2: {
      spacing: number;
      size: number;
      rotation: number;
      color: string;
    };
    goo: {
      blur: number;
      threshold: number;
    };
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const Canvas: React.FC<CanvasProps> = ({ settings, setSettings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const { toast } = useToast();

  // Initialize offscreen canvas
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Setup canvas and draw the initial pattern
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current.width = window.innerWidth;
        offscreenCanvasRef.current.height = window.innerHeight;
      }
      
      drawPattern();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Initial welcome toast after a small delay
    const timer = setTimeout(() => {
      toast({
        title: "Moire Pattern Explorer",
        description: "Double-click anywhere to open the control panel.",
      });
    }, 1000);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearTimeout(timer);
    };
  }, [toast]);

  // Redraw when settings change
  useEffect(() => {
    drawPattern();
  }, [settings, offset]);

  const drawPattern = () => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas) return;

    const ctx = canvas.getContext('2d');
    const offCtx = offscreenCanvas.getContext('2d');
    if (!ctx || !offCtx) return;

    // Clear both canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Common parameters
    const width = canvas.width;
    const height = canvas.height;

    // Draw first layer (static background)
    drawDotGrid(
      offCtx,
      width,
      height,
      settings.layer1.spacing,
      settings.layer1.size,
      settings.layer1.rotation,
      settings.layer1.color,
      0, 0 // No offset for base layer
    );

    // Apply goo effect to first layer
    applyGooEffect(offCtx, settings.goo.blur, settings.goo.threshold);

    // Draw second layer (movable)
    drawDotGrid(
      ctx,
      width,
      height,
      settings.layer2.spacing,
      settings.layer2.size,
      settings.layer2.rotation,
      settings.layer2.color,
      offset.x, offset.y // Apply offset for top layer
    );

    // Apply goo effect to second layer
    applyGooEffect(ctx, settings.goo.blur, settings.goo.threshold);

    // Draw the first layer on the main canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(offscreenCanvas, 0, 0);
  };

  const drawDotGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    spacing: number,
    dotSize: number,
    rotation: number,
    color: string,
    offsetX: number,
    offsetY: number
  ) => {
    // Save the current state
    ctx.save();
    
    // Translate to the center of the canvas
    ctx.translate(width / 2, height / 2);
    
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Calculate grid dimensions
    const gridWidth = width * 1.5; // Make grid larger than canvas to account for rotation
    const gridHeight = height * 1.5;
    
    // Calculate starting positions - ensure we have enough dots to fill the canvas
    const startX = -gridWidth / 2 + (offsetX % spacing);
    const startY = -gridHeight / 2 + (offsetY % spacing);
    
    // Draw the grid of dots
    ctx.fillStyle = color;
    
    for (let x = startX; x < gridWidth / 2; x += spacing) {
      for (let y = startY; y < gridHeight / 2; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Restore the original state
    ctx.restore();
  };

  const applyGooEffect = (
    ctx: CanvasRenderingContext2D,
    blur: number,
    threshold: number
  ) => {
    // Apply blur
    ctx.filter = `blur(${blur}px)`;
    
    // Create a temporary canvas to hold the blurred result
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ctx.canvas.width;
    tempCanvas.height = ctx.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the current canvas to the temp canvas (this applies the blur)
    tempCtx.filter = `blur(${blur}px)`;
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    // Clear the original canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.filter = 'none';
    
    // Apply threshold to the blurred image and draw back to original
    tempCtx.filter = 'none';
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Calculate grayscale value
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const v = 0.3 * r + 0.59 * g + 0.11 * b;
      
      // Apply threshold
      const a = v > threshold ? 255 : 0;
      
      // Keep original color but adjust alpha
      data[i + 3] = a;
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;
    
    // Double-click detection (300ms threshold)
    if (timeDiff < 300) {
      // Handle double-click
      setShowMenu(prev => !prev);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    } else {
      // Handle single click for dragging
      setIsDragging(true);
      dragStartRef.current = { 
        x: e.clientX - offset.x, 
        y: e.clientY - offset.y 
      };
    }
    
    lastClickTimeRef.current = currentTime;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMenuClose = () => {
    setShowMenu(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <canvas 
        ref={canvasRef}
        className="canvas-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {showMenu && (
        <RadialMenu 
          position={menuPosition}
          onClose={handleMenuClose}
          settings={settings}
          setSettings={setSettings}
        />
      )}
    </div>
  );
};

export default Canvas;
