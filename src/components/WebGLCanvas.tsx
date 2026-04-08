import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { GridRenderer } from "@/lib/webgl/GridRenderer";

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

const CANVAS_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  imageRendering: "pixelated",
};

const WebGLCanvas = forwardRef<HTMLCanvasElement, WebGLCanvasProps>(({
  width,
  height,
  settings,
  offset,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dpr = window.devicePixelRatio || 1;

  // The currently displayed canvas (grid or filter output) — swapped into the DOM
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Expose the currently displayed canvas for screenshots
  useImperativeHandle(ref, () => displayCanvasRef.current!, []);

  // Persistent WebGL filter — never recreated
  const filterRef = useRef<any>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);

  // 24 FPS draw throttle
  const lastDrawTimeRef = useRef(0);
  const pendingDrawRef = useRef<number | null>(null);
  const FRAME_INTERVAL = 1000 / 24;

  // Draw everything — renders to GPU canvases and swaps the visible one into the DOM
  const draw = () => {
    const container = containerRef.current;
    if (!container) return;

    // Lazy-init GridRenderer
    if (!gridRendererRef.current) {
      gridRendererRef.current = new GridRenderer();
    }
    const grid = gridRendererRef.current;

    grid.resize(width, height);
    grid.clear();
    grid.drawLayer(settings.layer1, 0, 0, dpr);
    grid.drawLayer(settings.layer2, offset.x, offset.y, dpr);

    let outputCanvas: HTMLCanvasElement;

    if (settings.goo.enabled) {
      if (!filterRef.current) {
        filterRef.current = new window.WebGLImageFilter();
      }
      const filter = filterRef.current;

      filter.reset();
      const scaledBlur = settings.goo.blur * dpr;
      const scaledPrePixelate = settings.goo.prePixelate * dpr;
      const scaledPostPixelate = settings.goo.postPixelate * dpr;
      filter.addFilter("pixelate", scaledPrePixelate);
      filter.addFilter("blur", scaledBlur);
      filter.addFilter("blur", scaledBlur);
      filter.addFilter("blur", scaledBlur);
      filter.addFilter("blur", scaledBlur);
      const thresholdFactor = settings.goo.threshold / 128;
      filter.addFilter("brightness", thresholdFactor);
      filter.addFilter("contrast", 20);
      filter.addFilter("polaroid");
      filter.addFilter("pixelate", scaledPostPixelate);

      outputCanvas = filter.apply(grid.canvas);
    } else {
      outputCanvas = grid.canvas;
    }

    // Swap displayed canvas if the source changed (e.g., goo toggled)
    if (displayCanvasRef.current !== outputCanvas) {
      if (displayCanvasRef.current?.parentNode === container) {
        container.removeChild(displayCanvasRef.current);
      }
      Object.assign(outputCanvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
      });
      container.appendChild(outputCanvas);
      displayCanvasRef.current = outputCanvas;
    }
  };

  // Initialize
  useEffect(() => {
    draw();
  }, []);

  // Update on changes — throttled to 24 FPS
  useEffect(() => {
    const now = performance.now();
    const elapsed = now - lastDrawTimeRef.current;

    if (elapsed >= FRAME_INTERVAL) {
      if (pendingDrawRef.current !== null) {
        clearTimeout(pendingDrawRef.current);
        pendingDrawRef.current = null;
      }
      lastDrawTimeRef.current = now;
      draw();
    } else if (pendingDrawRef.current === null) {
      const remaining = FRAME_INTERVAL - elapsed;
      pendingDrawRef.current = window.setTimeout(() => {
        pendingDrawRef.current = null;
        lastDrawTimeRef.current = performance.now();
        draw();
      }, remaining);
    }
  }, [settings, offset, width, height]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingDrawRef.current !== null) {
        clearTimeout(pendingDrawRef.current);
      }
      gridRendererRef.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.1)",
      }}
    />
  );
});

WebGLCanvas.displayName = 'WebGLCanvas';

export default WebGLCanvas;
