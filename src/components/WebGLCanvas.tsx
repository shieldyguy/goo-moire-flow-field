import React, { useRef, useEffect, forwardRef } from "react";
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
      type: "dots" | "lines" | "squares";
      numShapes?: number;
      strokeWidth?: number;
    };
    layer2: {
      spacing: number;
      size: number;
      rotation: number;
      color: string;
      type: "dots" | "lines" | "squares";
      numShapes?: number;
      strokeWidth?: number;
    };
    goo: {
      enabled: boolean;
      blur: number;
      threshold: number;
      prePixelate: number;
      postPixelate: number;
      posterizeLevels?: number;
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

const WebGLCanvas = forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ width, height, settings, offset }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const dpr = window.devicePixelRatio || 1;

    // The currently displayed canvas (grid or filter output) — swapped into the DOM
    const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Keep the forwarded ref in a local ref so we can update it directly from draw()
    const forwardedRef = useRef(ref);
    forwardedRef.current = ref;

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

        // Sharp outer alpha edge + per-channel posterize on the unpremul
        // color. Posterize on N discrete levels gives the hard-banded
        // "wild emergent shapes" without crushing every transition to RGB
        // corners. N=2 = full old-school crush (8 corners), higher = more
        // color nuance.
        //
        // The cutoff formula matches the old chain's effective threshold
        // (brightness*contrast(20) made R survive at premul-R > ~0.524 /
        // (1 + threshold/128)) — that's why blobs merge into connected
        // crescents at the default slider. A linear cutoff like
        // 1 - threshold/255 was way too tight and left dots isolated.
        const FIELD_MULT = 18;
        const cutoff = 0.524 / (1 + settings.goo.threshold / 128);
        const alphaBias = FIELD_MULT * cutoff;
        const posterizeLevels = settings.goo.posterizeLevels ?? 4;
        filter.addFilter(
          "gooThreshold",
          FIELD_MULT,
          alphaBias,
          posterizeLevels,
        );

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
        // Update the forwarded ref so parent's getSnapshot() returns the live canvas
        const fRef = forwardedRef.current;
        if (typeof fRef === "function") fRef(outputCanvas);
        else if (fRef)
          (fRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
            outputCanvas;
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
        gridRendererRef.current = null;
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
  },
);

WebGLCanvas.displayName = "WebGLCanvas";

export default WebGLCanvas;
