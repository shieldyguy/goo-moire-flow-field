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
      resolution: number; // Parameter for resolution/decimation
    };
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const Canvas: React.FC<CanvasProps> = ({ settings, setSettings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thresholdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const { toast } = useToast();

  // Initialize canvases
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    if (!combinedCanvasRef.current) {
      combinedCanvasRef.current = document.createElement('canvas');
    }
    if (!thresholdCanvasRef.current) {
      thresholdCanvasRef.current = document.createElement('canvas');
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
      
      if (combinedCanvasRef.current) {
        combinedCanvasRef.current.width = window.innerWidth;
        combinedCanvasRef.current.height = window.innerHeight;
      }
      
      if (thresholdCanvasRef.current) {
        thresholdCanvasRef.current.width = window.innerWidth;
        thresholdCanvasRef.current.height = window.innerHeight;
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
    const combinedCanvas = combinedCanvasRef.current;
    const thresholdCanvas = thresholdCanvasRef.current;
    
    if (!canvas || !offscreenCanvas || !combinedCanvas || !thresholdCanvas) return;

    const ctx = canvas.getContext('2d');
    const offCtx = offscreenCanvas.getContext('2d');
    const combinedCtx = combinedCanvas.getContext('2d');
    const thresholdCtx = thresholdCanvas.getContext('2d');
    
    if (!ctx || !offCtx || !combinedCtx || !thresholdCtx) return;

    // Clear all canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    combinedCtx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height);
    thresholdCtx.clearRect(0, 0, thresholdCanvas.width, thresholdCanvas.height);

    // Common parameters
    const width = canvas.width;
    const height = canvas.height;

    // Draw first layer (static background) on the offscreen canvas
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

    // Draw second layer (movable) on the main canvas
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

    // Combine both layers on the combinedCanvas
    combinedCtx.drawImage(offscreenCanvas, 0, 0);
    combinedCtx.globalCompositeOperation = 'source-over';
    combinedCtx.drawImage(canvas, 0, 0);

    // Apply resolution reduction (decimation) before goo effect
    if (settings.goo.resolution < 100) {
      const resizeFactor = settings.goo.resolution / 100;
      
      // Create a temporary small canvas for the reduced resolution
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      // Set the temporary canvas to the reduced size
      tempCanvas.width = Math.max(1, Math.floor(width * resizeFactor));
      tempCanvas.height = Math.max(1, Math.floor(height * resizeFactor));
      
      // Draw the combined result at reduced resolution
      tempCtx.drawImage(combinedCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Clear the combined canvas
      combinedCtx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height);
      
      // Scale the reduced resolution image back up
      combinedCtx.imageSmoothingEnabled = false; // Disable smoothing for pixelated effect
      combinedCtx.drawImage(
        tempCanvas, 
        0, 0, tempCanvas.width, tempCanvas.height,
        0, 0, combinedCanvas.width, combinedCanvas.height
      );
    }

    // Apply blur to the combined result
    thresholdCtx.filter = `blur(${settings.goo.blur}px)`;
    thresholdCtx.drawImage(combinedCanvas, 0, 0);
    thresholdCtx.filter = 'none';
    
    // Update CSS threshold variable
    document.documentElement.style.setProperty('--threshold', `${settings.goo.threshold}%`);
    
    // Draw the combined and blurred image to the main canvas
    // The CSS filter for threshold will be applied via a class on the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(thresholdCanvas, 0, 0);
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
    const gridWidth = width * 5; // Make grid larger than canvas to account for rotation
    const gridHeight = height * 5;
    
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;
    
    // Double-click detection (300ms threshold)
    if (timeDiff < 300) {
      // Handle double-click - store exact click position
      const clickX = e.clientX;
      const clickY = e.clientY;
      setMenuPosition({ x: clickX, y: clickY });
      setShowMenu(true);
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

  // Make sure double click handler sets the exact position
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent default double click behavior
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
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
        className="canvas-container threshold"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
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
