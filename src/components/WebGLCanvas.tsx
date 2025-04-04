import React, { useRef, useEffect } from 'react';

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

  // Draw a single layer of dots
  const drawLayer = (ctx: CanvasRenderingContext2D, layer: any, offsetX: number, offsetY: number) => {
    ctx.save();
    
    // Center the canvas
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX + offsetX, centerY + offsetY);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    const spacing = layer.spacing;
    const size = layer.size;
    const color = layer.color;

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw layers
    drawLayer(ctx, settings.layer1, 0, 0);
    drawLayer(ctx, settings.layer2, offset.x, offset.y);

    // Apply post-processing if enabled
    if (settings.goo.enabled) {
      const filter = new window.WebGLImageFilter();
      filter.addFilter('negative');
      const result = filter.apply(canvas);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(result, 0, 0);
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
        width: '100%', 
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.1)'
      }}
    />
  );
};

export default WebGLCanvas; 