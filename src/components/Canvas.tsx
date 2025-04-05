import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useToast } from "@/components/ui/use-toast";
import ControlPanel from './ControlPanel';
import WebGLCanvas from './WebGLCanvas';
import { encodePreset } from '@/lib/encoding/presetEncoder';
import GestureHandler from './GestureHandler';

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
      enabled: boolean;
      prePixelate: number;
      postPixelate: number;
    };
    touch?: {
      enablePinchZoom: boolean;
      enablePinchRotate: boolean;
    };
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

// Function to generate random colors (same as in ControlPanel and Index)
const generateRandomColor = () => {
  // Generate muted, stylish colors instead of fully saturated ones
  const h = Math.floor(Math.random() * 360); // Hue: 0-359
  const s = 40 + Math.floor(Math.random() * 30); // Saturation: 40-69%
  const l = 40 + Math.floor(Math.random() * 20); // Lightness: 40-59%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const Canvas: React.FC<CanvasProps> = ({ settings, setSettings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const { toast } = useToast();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  // Check WebGL support
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    setWebglSupported(!!gl);
  }, []);

  // Initialize canvases
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    if (!combinedCanvasRef.current) {
      combinedCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Handle resize and device pixel ratio
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      setDimensions({
        width: Math.floor(rect.width * dpr),
        height: Math.floor(rect.height * dpr)
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Setup canvas and draw the initial pattern
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const canvasScaleFactor = 0.5;
      canvas.width = window.innerWidth * canvasScaleFactor;
      canvas.height = window.innerHeight * canvasScaleFactor;

      if (offscreenCanvasRef.current) {
        offscreenCanvasRef.current.width = window.innerWidth * canvasScaleFactor;
        offscreenCanvasRef.current.height = window.innerHeight * canvasScaleFactor;
      }

      if (combinedCanvasRef.current) {
        combinedCanvasRef.current.width = window.innerWidth * canvasScaleFactor;
        combinedCanvasRef.current.height = window.innerHeight * canvasScaleFactor;
      }

      drawPattern();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });

  // Redraw when settings change
  useEffect(() => {
    drawPattern();
  }, [settings, offset]);

  const drawPattern = () => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    const combinedCanvas = combinedCanvasRef.current;
    if (!canvas || !offscreenCanvas || !combinedCanvas) return;

    const ctx = canvas.getContext('2d');
    const offCtx = offscreenCanvas.getContext('2d');
    const combinedCtx = combinedCanvas.getContext('2d');
    if (!ctx || !offCtx || !combinedCtx) return;

    // Clear all canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    combinedCtx.clearRect(0, 0, combinedCanvas.width, combinedCanvas.height);

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

    // Apply goo effect to the combined result
    applyGooEffect(combinedCtx, settings.goo.blur, settings.goo.threshold);

    // Clear the main canvas and draw the combined result with goo effect
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(combinedCanvas, 0, 0);
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

    // Apply translation
    ctx.translate(offsetX, offsetY);

    // Apply rotation 
    ctx.rotate((rotation * Math.PI) / 180);

    // Calculate grid dimensions
    const gridWidth = width * 5; // Make grid larger than canvas to account for rotation
    const gridHeight = height * 5;

    // Calculate starting positions - ensure we have enough dots to fill the canvas
    const startX = -gridWidth / 2;
    const startY = -gridHeight / 2;

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    // Close menu if it's open and we click outside
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    if (timeDiff < 300) {
      setShowMenu(true);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    } else {
      // Normal drag behavior
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      };
    }

    lastClickTimeRef.current = currentTime;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default to avoid scrolling
    
    const touch = e.touches[0];
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;
    
    // Close menu if it's open and we touch outside
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    // Check for double tap
    if (timeDiff < 300 && timeDiff > 0) {
      // It's a double tap - open menu at this location
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowMenu(true);
      return;
    }
    
    // Store this click time for next time
    lastClickTimeRef.current = currentTime;
    
    // Regular touch - start dragging
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX - offset.x,
      y: touch.clientY - offset.y
    };
  };
  
  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default to avoid scrolling
    
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.x;
    const deltaY = touch.clientY - dragStartRef.current.y;
    
    setOffset({
      x: deltaX,
      y: deltaY
    });
  };
  
  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent default to avoid scrolling
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setShowMenu(prev => !prev);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMenuClose = () => {
    setShowMenu(false);
  };

  const handlePan = (deltaX: number, deltaY: number) => {
    setOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
  };

  const handlePinch = (newScale: number) => {
    if (!settings.touch?.enablePinchZoom) return;
    
    // Limit scale between 0.5 and 2.0
    const clampedScale = Math.min(Math.max(newScale, 0.5), 2.0);
    setScale(clampedScale);
    
    // Update spacing and size proportionally
    setSettings(prev => ({
      ...prev,
      layer2: {
        ...prev.layer2,
        spacing: settings.layer2.spacing * clampedScale,
        size: settings.layer2.size * clampedScale
      }
    }));
  };

  const handleRotate = (newRotation: number) => {
    if (!settings.touch?.enablePinchRotate) return;
    
    // Update rotation (in degrees)
    setRotation(prev => prev + newRotation);
    
    // Update layer rotation
    setSettings(prev => ({
      ...prev,
      layer2: {
        ...prev.layer2,
        rotation: settings.layer2.rotation + newRotation
      }
    }));
  };

  const handleDoubleTap = (x: number, y: number) => {
    setMenuPosition({ x, y });
    setShowMenu(true);
  };

  return (
    <GestureHandler
      onPan={handlePan}
      onPinch={handlePinch}
      onRotate={handleRotate}
      onDoubleTap={handleDoubleTap}
    >
      <div ref={containerRef} className="relative w-full h-full canvas-container">
        {/* Original Canvas */}
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: webglSupported ? 0 : 1 // Hide if WebGL is supported
          }}
        />

        {/* WebGL Canvas */}
        {webglSupported && (
          <WebGLCanvas
            width={dimensions.width}
            height={dimensions.height}
            settings={settings}
            offset={offset}
          />
        )}

        {/* Interaction layer */}
        <div
          className="absolute inset-0 interaction-layer"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
        />

        {/* Control Panel */}
        {showMenu && (
          <ControlPanel
            position={menuPosition}
            settings={settings}
            setSettings={setSettings}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </GestureHandler>
  );
};

export default Canvas;
