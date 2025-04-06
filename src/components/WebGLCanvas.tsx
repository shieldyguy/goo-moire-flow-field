import React, { useRef, useEffect } from "react";

// Add a declaration for the WebGLImageFilter
declare global {
  interface Window {
    WebGLImageFilter: any;
  }
}

interface WebGLCanvasProps {
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
}

const WebGLCanvas: React.FC<WebGLCanvasProps> = ({
  width,
  height,
  settings,
  offset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dpr = window.devicePixelRatio || 1;

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
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX + offsetX, centerY + offsetY);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    const spacing = layer.spacing * dpr; // Scale spacing with DPR
    const size = layer.size * dpr; // Scale size with DPR
    const color = layer.color;
    const type = layer.type || 'dots'; // Default to dots if not specified

    if (type === 'dots') {
      // Draw dots in a grid
      for (let x = -width; x < width * 2; x += spacing) {
        for (let y = -height; y < height * 2; y += spacing) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === 'lines') {
      // Draw lines in a grid
      for (let x = -width; x < width * 2; x += spacing) {
        for (let y = -height; y < height * 2; y += spacing) {
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
      for (let x = -width; x < width * 2; x += spacing) {
        for (let y = -height; y < height * 2; y += spacing) {
          drawConcentricSquares(ctx, x, y, size, color, layer.numShapes, layer.strokeWidth);
        }
      }
    }

    ctx.restore();
  };

  // Draw everything
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw layers
    drawLayer(ctx, settings.layer1, 0, 0);
    drawLayer(ctx, settings.layer2, offset.x, offset.y);

    // Apply post-processing if enabled
    if (settings.goo.enabled) {
      // Create a temp canvas for the filter process
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // Copy current canvas to temp
        tempCtx.drawImage(canvas, 0, 0);
        
        // Apply WebGL filter
        const filter = new window.WebGLImageFilter();

        filter.addFilter("pixelate", settings.goo.prePixelate);
        filter.addFilter("blur", settings.goo.blur); 
        filter.addFilter("blur", settings.goo.blur); 
        filter.addFilter("blur", settings.goo.blur); 
        filter.addFilter("blur", settings.goo.blur);
        const thresholdFactor = settings.goo.threshold / 128; // Normalize to 0-1 range     
        filter.addFilter("brightness", thresholdFactor);
        filter.addFilter("contrast", 20);
        filter.addFilter("polaroid");
        filter.addFilter("pixelate", settings.goo.postPixelate);
        
        // Apply the filter and draw back to original canvas
        const result = filter.apply(tempCanvas);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(result, 0, 0);
      }
    }
  };

  // Initialize
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    draw();
  }, []);

  // Update on changes
  useEffect(() => {
    draw();
  }, [settings, offset, width, height]);

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

export default WebGLCanvas;
