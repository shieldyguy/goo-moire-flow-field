import React, { useRef, useEffect, useState } from 'react';
import { WebGLImageFilterWrapper } from '@/lib/webgl/WebGLImageFilterWrapper';

interface WebGLCanvasProps {
  width: number;
  height: number;
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
  offset: {
    x: number;
    y: number;
  };
}

const WebGLCanvas: React.FC<WebGLCanvasProps> = ({ width, height, settings, offset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageFilter, setImageFilter] = useState<WebGLImageFilterWrapper | null>(null);

  // Draw a single layer of dots
  const drawLayer = (ctx: CanvasRenderingContext2D, layer: any, offsetX: number, offsetY: number) => {
    console.log('Drawing layer with settings:', {
      layer,
      offsetX,
      offsetY,
      width,
      height,
      canvasWidth: ctx.canvas.width,
      canvasHeight: ctx.canvas.height
    });
    
    ctx.save();
    
    // Center the canvas
    const centerX = width / 2;
    const centerY = height / 2;
    console.log('Canvas center:', { centerX, centerY });
    
    ctx.translate(centerX + offsetX, centerY + offsetY);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    const spacing = layer.spacing;
    const size = layer.size;
    const color = layer.color;

    console.log('Drawing dots with:', { spacing, size, color });

    // Draw dots in a grid
    for (let x = -width; x < width * 2; x += spacing) {
      for (let y = -height; y < height * 2; y += spacing) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  // Draw everything
  const draw = () => {
    console.log('Starting draw function');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('No canvas element found');
      return;
    }

    console.log('Canvas element found:', {
      width: canvas.width,
      height: canvas.height,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('Could not get 2D context');
      return;
    }

    console.log('Got 2D context successfully');

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw layers
    drawLayer(ctx, settings.layer1, 0, 0);
    drawLayer(ctx, settings.layer2, offset.x, offset.y);

    // Apply post-processing if enabled
    if (settings.goo.enabled && imageFilter) {
      console.log('Applying post-processing effects');
      
      // Get the temp canvas
      const tempCanvas = tempCanvasRef.current;
      if (!tempCanvas) {
        console.log('No temp canvas available');
        return;
      }

      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.log('Could not get temp canvas context');
        return;
      }

      // Copy the main canvas to the temp canvas
      tempCtx.clearRect(0, 0, width, height);
      tempCtx.drawImage(canvas, 0, 0);

      // Apply filters to the temp canvas
      imageFilter
        .applyBlur(settings.goo.blur)
        .applyThreshold(settings.goo.threshold)
        .apply(tempCanvas);

      // Clear the main canvas and draw the filtered result
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  };

  // Initialize
  useEffect(() => {
    console.log('Initializing canvas with dimensions:', { width, height });
    
    if (!canvasRef.current || !tempCanvasRef.current) {
      console.log('Canvas refs not available');
      return;
    }

    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    
    console.log('Setting canvas dimensions:', { width, height });
    canvas.width = width;
    canvas.height = height;
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Initialize WebGLImageFilter with the temp canvas
    if (typeof window.WebGLImageFilter !== 'undefined') {
      console.log('WebGLImageFilter is available');
      const filter = new WebGLImageFilterWrapper(tempCanvas);
      setImageFilter(filter);
    } else {
      console.log('WebGLImageFilter is NOT available');
    }

    // Draw initial frame
    draw();
  }, []);

  // Update on changes
  useEffect(() => {
    console.log('Settings or offset changed:', { settings, offset });
    draw();
  }, [settings, offset, width, height]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', 
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.1)'
        }}
      />
      <canvas
        ref={tempCanvasRef}
        width={width}
        height={height}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', 
          height: '100%',
          opacity: 0 // Hide the temp canvas
        }}
      />
    </div>
  );
};

export default WebGLCanvas; 