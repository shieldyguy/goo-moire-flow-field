import React, { useRef, useEffect } from "react";

interface RendererProps {
  width: number;
  height: number;
  settings: {
    layer1: {
      spacing: number;
      size: number;
      rotation: number;
      color: string;
      type: 'dots' | 'lines' | 'squares';
      numShapes?: number;
      strokeWidth?: number;
    };
    layer2: {
      spacing: number;
      size: number;
      rotation: number;
      color: string;
      type: 'dots' | 'lines' | 'squares';
      numShapes?: number;
      strokeWidth?: number;
    };
    goo: {
      enabled: boolean;
      blur: number;
      threshold: number;
      prePixelate: number;
      postPixelate: number;
    };
  };
  offset: {
    x: number;
    y: number;
  };
  targetFps?: number; // Optional target FPS, defaults to 12
}

const Renderer: React.FC<RendererProps> = ({
  width,
  height,
  settings,
  offset,
  targetFps = 12 // Default to 12 FPS if not specified
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = window.devicePixelRatio || 1;
  
  // Animation and throttling refs
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const frameIntervalMs = useRef<number>(Math.floor(1000 / targetFps));
  const isPendingRenderRef = useRef<boolean>(false);
  
  // State references for animation loop
  const settingsRef = useRef(settings);
  const offsetRef = useRef(offset);
  const dimensionsRef = useRef({ width, height });

  // Update refs when props change
  useEffect(() => {
    const offsetChanged = offset.x !== offsetRef.current.x || offset.y !== offsetRef.current.y;
    
    // Update refs with current prop values
    settingsRef.current = settings;
    offsetRef.current = offset;
    dimensionsRef.current = { width, height };
    
    // Mark that a render is needed
    isPendingRenderRef.current = true;
    
    // If this is an offset change from dragging, we might want to render immediately
    // rather than waiting for the next animation frame cycle
    if (offsetChanged) {
      drawPattern();
    }
  }, [settings, offset, width, height]);
  
  // Update frame interval when targetFps changes
  useEffect(() => {
    frameIntervalMs.current = Math.floor(1000 / targetFps);
  }, [targetFps]);

  // Initialize and update canvas dimensions
  useEffect(() => {
    // Only proceed if we have valid dimensions
    if (width <= 0 || height <= 0) return;
    
    // Initialize or resize the main canvas
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    
    // Initialize or resize the offscreen canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    offscreenCanvasRef.current.width = width;
    offscreenCanvasRef.current.height = height;
    
    // Initialize or resize the combined canvas
    if (!combinedCanvasRef.current) {
      combinedCanvasRef.current = document.createElement('canvas');
    }
    combinedCanvasRef.current.width = width;
    combinedCanvasRef.current.height = height;
    
    // Mark that a render is needed
    isPendingRenderRef.current = true;
  }, [width, height]);

  // Helper function to draw concentric squares
  const drawConcentricSquares = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    numShapes: number = 3,
    strokeWidth: number = 1
  ) => {
    // Number of squares to draw (use parameter or default to 3)
    const numSquares = numShapes || 3;
    
    // Size reduction for each inner square
    const sizeStep = size / numSquares;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth || 1;
    
    for (let i = 0; i < numSquares; i++) {
      const currentSize = size - (sizeStep * i);
      const halfSize = currentSize / 2;
      
      ctx.beginPath();
      // Draw square from centerpoint
      ctx.rect(x - halfSize, y - halfSize, currentSize, currentSize);
      ctx.stroke();
    }
  };

  // Draw a single layer of dots, lines or concentric squares
  const drawLayer = (
    ctx: CanvasRenderingContext2D,
    layer: any,
    offsetX: number,
    offsetY: number
  ) => {
    ctx.save();

    // Center the canvas
    const centerX = dimensionsRef.current.width / 2;
    const centerY = dimensionsRef.current.height / 2;
    ctx.translate(centerX + offsetX, centerY + offsetY);
    
    // Apply rotation transformation
    ctx.rotate((layer.rotation * Math.PI) / 180);

    const spacing = layer.spacing * dpr; // Scale spacing with DPR
    const size = layer.size * dpr; // Scale size with DPR
    const color = layer.color;
    const type = layer.type || 'dots'; // Default to dots if not specified

    if (type === 'dots') {
      // Draw dots in a grid
      for (let x = -dimensionsRef.current.width; x < dimensionsRef.current.width * 2; x += spacing) {
        for (let y = -dimensionsRef.current.height; y < dimensionsRef.current.height * 2; y += spacing) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'lines') {
      // Draw lines in a grid
      for (let x = -dimensionsRef.current.width; x < dimensionsRef.current.width * 2; x += spacing) {
        for (let y = -dimensionsRef.current.height; y < dimensionsRef.current.height * 2; y += spacing) {
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(x - spacing / 2 - 1, y + 0.5);
          ctx.lineTo(x + spacing / 2 + 1, y + 0.5);
          ctx.stroke();
        }
      }
    } else if (type === 'squares') {
      // Draw concentric squares in a grid
      for (let x = -dimensionsRef.current.width; x < dimensionsRef.current.width * 2; x += spacing) {
        for (let y = -dimensionsRef.current.height; y < dimensionsRef.current.height * 2; y += spacing) {
          drawConcentricSquares(ctx, x, y, size, color, layer.numShapes, layer.strokeWidth);
        }
      }
    }

    ctx.restore();
  };

  // Apply goo effect using the WebGLImageFilter library
  const applyGooEffect = (canvas: HTMLCanvasElement) => {
    if (!settingsRef.current.goo.enabled) return canvas;
    
    // Create a temp canvas for the filter process
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return canvas;
    
    // Copy current canvas to temp
    tempCtx.drawImage(canvas, 0, 0);
    
    try {
      // Apply WebGL filter
      const filter = new window.WebGLImageFilter();
      
      filter.addFilter("pixelate", settingsRef.current.goo.prePixelate);
      filter.addFilter("blur", settingsRef.current.goo.blur); 
      filter.addFilter("blur", settingsRef.current.goo.blur); 
      filter.addFilter("blur", settingsRef.current.goo.blur); 
      filter.addFilter("blur", settingsRef.current.goo.blur);
      const thresholdFactor = settingsRef.current.goo.threshold / 128; // Normalize to 0-1 range     
      filter.addFilter("brightness", thresholdFactor);
      filter.addFilter("contrast", 20);
      filter.addFilter("polaroid");
      filter.addFilter("pixelate", settingsRef.current.goo.postPixelate);
      
      // Apply the filter
      return filter.apply(tempCanvas);
    } catch (error) {
      console.error('WebGLImageFilter error:', error);
      return canvas;
    }
  };

  // Draw everything - now respects the frame rate limit
  const drawPattern = () => {
    // Check for valid dimensions and canvases
    if (dimensionsRef.current.width <= 0 || dimensionsRef.current.height <= 0) return;
    
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    const combinedCanvas = combinedCanvasRef.current;
    
    if (!canvas || !offscreenCanvas || !combinedCanvas) return;
    
    // Double-check dimensions are set correctly
    if (canvas.width <= 0 || canvas.height <= 0 || 
        offscreenCanvas.width <= 0 || offscreenCanvas.height <= 0 ||
        combinedCanvas.width <= 0 || combinedCanvas.height <= 0) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const offCtx = offscreenCanvas.getContext('2d');
    const combinedCtx = combinedCanvas.getContext('2d');
    
    if (!ctx || !offCtx || !combinedCtx) return;

    // Clear canvases
    ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
    offCtx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
    combinedCtx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);

    // Draw first layer (static background) on the offscreen canvas
    drawLayer(offCtx, settingsRef.current.layer1, 0, 0);
    
    // Draw second layer (movable) on another offscreen canvas
    drawLayer(ctx, settingsRef.current.layer2, offsetRef.current.x, offsetRef.current.y);

    // Combine both layers on the combinedCanvas
    combinedCtx.drawImage(offscreenCanvas, 0, 0);
    combinedCtx.globalCompositeOperation = 'source-over';
    combinedCtx.drawImage(canvas, 0, 0);

    // Apply goo effect if enabled
    if (settingsRef.current.goo.enabled) {
      const processedCanvas = applyGooEffect(combinedCanvas);
      
      // Draw the processed result to the main canvas
      ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
      ctx.drawImage(processedCanvas, 0, 0);
    } else {
      // Draw the combined result to the main canvas
      ctx.clearRect(0, 0, dimensionsRef.current.width, dimensionsRef.current.height);
      ctx.drawImage(combinedCanvas, 0, 0);
    }
    
    // Reset the pending render flag
    isPendingRenderRef.current = false;
  };

  // Animation loop with frame rate throttling
  useEffect(() => {
    const animationLoop = (timestamp: number) => {
      // Calculate time since last render
      const elapsed = timestamp - lastRenderTimeRef.current;
      
      // Check if enough time has passed for the next frame and if a render is pending
      if ((elapsed >= frameIntervalMs.current || lastRenderTimeRef.current === 0) && isPendingRenderRef.current) {
        // Render the frame
        drawPattern();
        
        // Update the last render time
        lastRenderTimeRef.current = timestamp;
      }
      
      // Schedule the next frame
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animationLoop);
    
    // Cleanup when component unmounts
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.1)",
        imageRendering: "pixelated",
      }}
    />
  );
};

export default Renderer; 