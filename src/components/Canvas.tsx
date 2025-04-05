import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useToast } from "@/components/ui/use-toast";
import ControlPanel from './ControlPanel';
import QuickControlsRing from './QuickControlsRing';
import WebGLCanvas from './WebGLCanvas';
import { encodePreset } from '@/lib/encoding/presetEncoder';

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
      resolution: number;
      enabled: boolean;
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

  // Add WebGL support state
  const [webglSupported, setWebglSupported] = useState(false);

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

  const [showQuickControls, setShowQuickControls] = useState(false);
  const [quickControlsPosition, setQuickControlsPosition] = useState({ x: 0, y: 0 });
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle long press for quick controls
  const handleLongPress = (event: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    event.preventDefault();
    setQuickControlsPosition({ x: clientX, y: clientY });
    setShowQuickControls(true);
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Start long press timer
    longPressTimeoutRef.current = setTimeout(() => {
      handleLongPress(e, e.clientX, e.clientY);
    }, 500); // 500ms for long press

    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    if (timeDiff < 300) {
      setShowMenu(prev => !prev);
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
    // Clear long press timer on move
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (!isDragging) return;

    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    // Clear long press timer on mouse up
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    // Start long press timer
    longPressTimeoutRef.current = setTimeout(() => {
      handleLongPress(e, touch.clientX, touch.clientY);
    }, 500); // 500ms for long press

    if (timeDiff < 300) {
      setShowMenu(prev => !prev);
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
    } else {
      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y
      };
    }

    lastClickTimeRef.current = currentTime;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Clear long press timer on move
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Clear long press timer on touch end
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    
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

  // Handle quick control actions
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'reset':
        // Reset settings with random colors
        const resetColor1 = generateRandomColor();
        const resetColor2 = generateRandomColor();
        
        setSettings({
          layer1: {
            spacing: 30,
            size: 8,
            rotation: 0,
            color: resetColor1
          },
          layer2: {
            spacing: 30,
            size: 8,
            rotation: 45,
            color: resetColor2
          },
          goo: {
            enabled: false,
            blur: 8,
            threshold: 128,
            resolution: 100
          }
        });
        break;
      case 'randomize':
        // Generate random settings with random colors
        const randomColor1 = generateRandomColor();
        const randomColor2 = generateRandomColor();
        
        setSettings({
          layer1: {
            spacing: Math.floor(Math.random() * 70) + 10,
            size: Math.floor(Math.random() * 20) + 1,
            rotation: Math.floor(Math.random() * 360),
            color: randomColor1
          },
          layer2: {
            spacing: Math.floor(Math.random() * 70) + 10,
            size: Math.floor(Math.random() * 20) + 1,
            rotation: Math.floor(Math.random() * 360),
            color: randomColor2
          },
          goo: {
            enabled: Math.random() > 0.5,
            blur: Math.floor(Math.random() * 30) + 1,
            threshold: Math.floor(Math.random() * 200) + 50,
            resolution: Math.floor(Math.random() * 90) + 10
          }
        });
        break;
      case 'export':
        try {
          const encoded = encodePreset(settings);
          const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
          
          navigator.clipboard.writeText(url).then(() => {
            toast({
              title: "Preset Exported",
              description: "URL copied to clipboard!",
            });
          }).catch(() => {
            toast({
              title: "Export Failed",
              description: "Could not copy to clipboard",
              variant: "destructive",
            });
          });
        } catch (error) {
          toast({
            title: "Export Failed",
            description: "Could not encode preset",
            variant: "destructive",
          });
        }
        break;
      case 'increase':
        // Increase pattern sizes
        setSettings(prev => ({
          ...prev,
          layer1: {
            ...prev.layer1,
            size: Math.min(prev.layer1.size + 2, 80)
          },
          layer2: {
            ...prev.layer2,
            size: Math.min(prev.layer2.size + 2, 80)
          }
        }));
        break;
      case 'decrease':
        // Decrease pattern sizes
        setSettings(prev => ({
          ...prev,
          layer1: {
            ...prev.layer1,
            size: Math.max(prev.layer1.size - 2, 1)
          },
          layer2: {
            ...prev.layer2,
            size: Math.max(prev.layer2.size - 2, 1)
          }
        }));
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
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
        className="absolute inset-0"
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

      {/* Quick Controls Ring */}
      {showQuickControls && (
        <QuickControlsRing
          position={quickControlsPosition}
          onClose={() => setShowQuickControls(false)}
          onAction={handleQuickAction}
          open={showQuickControls}
          setOpen={setShowQuickControls}
        />
      )}
    </div>
  );
};

export default Canvas;
