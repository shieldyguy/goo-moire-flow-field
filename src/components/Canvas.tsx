import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import ControlPanel from "./ControlPanel";
import WebGLCanvas from "./WebGLCanvas";
import GestureHandler from "./GestureHandler";
import { useSonification } from "@/audio/useSonification";

// Custom hook to throttle a function to limit how often it's called
// defaultFps = 60 means the function can be called at most once every ~16.6ms
const useThrottle = <T extends (...args: any[]) => any>(
  fn: T,
  fps: number = 12,
): T => {
  const lastCall = useRef<number>(0);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const lastArgs = useRef<any[]>([]);

  // Calculate throttle delay in ms based on fps
  const throttleMs = 1000 / fps;

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      lastArgs.current = args;

      // If enough time has passed since last call, execute immediately
      if (now - lastCall.current >= throttleMs) {
        lastCall.current = now;
        return fn(...args);
      }

      // Otherwise, set a timeout to execute after the throttle period
      if (timeout.current === null) {
        timeout.current = setTimeout(
          () => {
            lastCall.current = Date.now();
            timeout.current = null;
            fn(...lastArgs.current);
          },
          throttleMs - (now - lastCall.current),
        );
      }
    }) as T,
    [fn, throttleMs],
  );
};

interface CanvasProps {
  // Default values for our parameters
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
      blur: number;
      threshold: number;
      enabled: boolean;
      prePixelate: number;
      postPixelate: number;
      driftFriction: number;
    };
    touch?: {
      enablePinchZoom: boolean;
      enablePinchRotate: boolean;
    };
    audio: {
      enabled: boolean;
      masterVolume: number;
      interactionRadius: number;
      frequencyRange: { min: number; max: number };
      rampTimeMs: number;
      maxVoices: number;
      luminanceInfluence: number;
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
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const { toast } = useToast();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [initialLayerRotation, setInitialLayerRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const interactionLayerRef = useRef<HTMLDivElement>(null);

  // Audio engine — needs layer configs, offset, and canvas dimensions (CSS pixels)
  const dpr = window.devicePixelRatio || 1;
  const cssW = dimensions.width / dpr;
  const cssH = dimensions.height / dpr;
  const { initializeAudio } = useSonification(
    settings.audio,
    settings.layer1,
    settings.layer2,
    offset,
    cssW,
    cssH,
    webglCanvasRef,
  );

  // Drift refs
  const dragSamplesRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const driftAnimRef = useRef<number | null>(null);
  const driftVelocityRef = useRef({ vx: 0, vy: 0 });
  const driftOffsetRef = useRef({ x: 0, y: 0 });
  const lastDriftTimeRef = useRef(0);
  const driftSetOffsetThrottleRef = useRef(0);

  // Adjust this number to change the max frame rate (higher = smoother, lower = more performance)
  const throttledSetOffset = useThrottle(setOffset, 15);

  const getSnapshot = useCallback((): HTMLCanvasElement | null => {
    return webglCanvasRef.current;
  }, []);

  // --- Drift functions ---

  const recordDragSample = (x: number, y: number) => {
    const now = performance.now();
    dragSamplesRef.current.push({ x, y, t: now });
    // Prune samples older than 100ms
    const cutoff = now - 100;
    while (
      dragSamplesRef.current.length > 0 &&
      dragSamplesRef.current[0].t < cutoff
    ) {
      dragSamplesRef.current.shift();
    }
  };

  const computeDriftVelocity = () => {
    const samples = dragSamplesRef.current;
    if (samples.length < 2) return { vx: 0, vy: 0 };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.t - first.t) / 1000; // seconds
    if (dt < 0.016) return { vx: 0, vy: 0 };
    return {
      vx: (last.x - first.x) / dt,
      vy: (last.y - first.y) / dt,
    };
  };

  const stopDrift = () => {
    if (driftAnimRef.current !== null) {
      cancelAnimationFrame(driftAnimRef.current);
      driftAnimRef.current = null;
    }
    driftVelocityRef.current = { vx: 0, vy: 0 };
    dragSamplesRef.current = [];
  };

  const startDrift = (vx: number, vy: number) => {
    if (Math.hypot(vx, vy) < 5) return;
    stopDrift();

    driftVelocityRef.current = { vx, vy };
    const samples = dragSamplesRef.current;
    if (samples.length > 0) {
      const last = samples[samples.length - 1];
      driftOffsetRef.current = { x: last.x, y: last.y };
      setOffset({ x: last.x, y: last.y });
    } else {
      driftOffsetRef.current = { ...offset };
    }
    lastDriftTimeRef.current = performance.now();
    driftSetOffsetThrottleRef.current = 0;

    const friction = settings.goo.driftFriction ?? 0;

    const tick = (now: number) => {
      let dt = (now - lastDriftTimeRef.current) / 1000; // seconds
      if (dt > 0.1) dt = 0.1; // cap for tab backgrounding
      lastDriftTimeRef.current = now;

      const vel = driftVelocityRef.current;

      // Apply friction (frame-rate-independent)
      if (friction > 0) {
        const decay = Math.pow(1 - friction / 100, dt * 60);
        vel.vx *= decay;
        vel.vy *= decay;
      }

      // Accumulate position
      driftOffsetRef.current.x += vel.vx * dt;
      driftOffsetRef.current.y += vel.vy * dt;

      // Throttle setOffset calls to ~15 FPS
      const throttleInterval = 1000 / 24;
      if (now - driftSetOffsetThrottleRef.current >= throttleInterval) {
        driftSetOffsetThrottleRef.current = now;
        const newOffset = {
          x: driftOffsetRef.current.x,
          y: driftOffsetRef.current.y,
        };
        setOffset(newOffset);
      }

      // Stop when speed is negligible (only matters with friction)
      if (friction > 0 && Math.hypot(vel.vx, vel.vy) < 0.5) {
        driftAnimRef.current = null;
        return;
      }

      driftAnimRef.current = requestAnimationFrame(tick);
    };

    driftAnimRef.current = requestAnimationFrame(tick);
  };

  // Cleanup drift rAF on unmount
  useEffect(() => {
    return () => {
      if (driftAnimRef.current !== null) {
        cancelAnimationFrame(driftAnimRef.current);
      }
    };
  }, []);

  // Handle resize and device pixel ratio
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      setDimensions({
        width: Math.floor(rect.width * dpr),
        height: Math.floor(rect.height * dpr),
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    // Close menu if it's open and we click outside
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    if (timeDiff < 300) {
      // Double-click opens menu — don't stop drift so the pattern keeps moving
      setShowMenu(true);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    } else {
      // Prepare for drag but don't stop drift yet — if this turns out to be
      // the first click of a double-click, drift survives. Drift is stopped
      // lazily on the first actual mouse move.
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      };
    }

    lastClickTimeRef.current = currentTime;
  };

  const hasDragMovedRef = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    // Stop drift on first actual move, not on mousedown
    if (!hasDragMovedRef.current) {
      stopDrift();
      hasDragMovedRef.current = true;
    }

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    recordDragSample(newX, newY);
    throttledSetOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (isDragging && hasDragMovedRef.current) {
      const { vx, vy } = computeDriftVelocity();
      startDrift(vx, vy);
    }
    setIsDragging(false);
    hasDragMovedRef.current = false;
  };

  // Set up non-passive event listeners properly
  useEffect(() => {
    const interactionLayer = interactionLayerRef.current;
    if (!interactionLayer) return;

    // These handlers will be able to use preventDefault() without warnings
    const handleTouchStartEvent = (e: TouchEvent) => {
      e.preventDefault(); // This works with {passive: false}

      if (e.touches.length > 1) {
        return;
      }

      const touch = e.touches[0];
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastClickTimeRef.current;

      if (showMenu) {
        setShowMenu(false);
        return;
      }

      if (timeDiff < 250 && timeDiff > 50) {
        // Double-tap opens menu — don't stop drift
        setMenuPosition({ x: touch.clientX, y: touch.clientY });
        setShowMenu(true);
        return;
      }

      lastClickTimeRef.current = currentTime;

      // Prepare for drag but don't stop drift yet — same lazy approach as mouse
      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      };
    };

    const handleTouchMoveEvent = (e: TouchEvent) => {
      e.preventDefault();

      if (!isDragging) return;

      // Stop drift on first actual move
      if (!hasDragMovedRef.current) {
        stopDrift();
        hasDragMovedRef.current = true;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      recordDragSample(deltaX, deltaY);
      throttledSetOffset({
        x: deltaX,
        y: deltaY,
      });
    };

    const handleTouchEndEvent = (e: TouchEvent) => {
      e.preventDefault();
      if (isDragging && hasDragMovedRef.current) {
        const { vx, vy } = computeDriftVelocity();
        startDrift(vx, vy);
      }
      setIsDragging(false);
      hasDragMovedRef.current = false;
    };

    // Add event listeners with {passive: false} option
    interactionLayer.addEventListener("touchstart", handleTouchStartEvent, {
      passive: false,
    });
    interactionLayer.addEventListener("touchmove", handleTouchMoveEvent, {
      passive: false,
    });
    interactionLayer.addEventListener("touchend", handleTouchEndEvent, {
      passive: false,
    });

    // Clean up
    return () => {
      interactionLayer.removeEventListener("touchstart", handleTouchStartEvent);
      interactionLayer.removeEventListener("touchmove", handleTouchMoveEvent);
      interactionLayer.removeEventListener("touchend", handleTouchEndEvent);
    };
  }, [isDragging, offset, showMenu]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setShowMenu((prev) => !prev);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMenuClose = () => {
    setShowMenu(false);
  };

  const handlePanStart = () => {
    stopDrift();
  };

  const handlePan = (deltaX: number, deltaY: number) => {
    throttledSetOffset((prev) => {
      const newX = prev.x + deltaX;
      const newY = prev.y + deltaY;
      recordDragSample(newX, newY);
      return { x: newX, y: newY };
    });
  };

  const handlePanEnd = () => {
    const { vx, vy } = computeDriftVelocity();
    startDrift(vx, vy);
  };

  const handlePinch = (newScale: number) => {
    if (!settings.touch?.enablePinchZoom) return;

    // Limit scale between 0.5 and 2.0
    const clampedScale = Math.min(Math.max(newScale, 0.5), 2.0);
    setScale(clampedScale);

    // Update spacing and size proportionally
    setSettings((prev) => ({
      ...prev,
      layer2: {
        ...prev.layer2,
        spacing: settings.layer2.spacing * clampedScale,
        size: settings.layer2.size * clampedScale,
      },
    }));
  };

  // Handle rotation start
  const handleRotateStart = () => {
    // Only proceed if rotation is enabled
    if (!settings.touch?.enablePinchRotate) return;

    stopDrift();

    // Close menu if it's open
    if (showMenu) {
      setShowMenu(false);
    }

    // Store starting rotation
    setInitialLayerRotation(settings.layer2.rotation);
    setIsRotating(true);
  };

  // Handle rotation gesture
  const handleRotate = (rotationDegrees: number) => {
    if (!settings.touch?.enablePinchRotate || !isRotating) return;

    // Calculate new rotation value
    const newRotation = (initialLayerRotation + rotationDegrees) % 360;
    const normalizedRotation =
      newRotation < 0 ? newRotation + 360 : newRotation;

    // Update layer2 rotation
    setSettings((prev) => ({
      ...prev,
      layer2: {
        ...prev.layer2,
        rotation: normalizedRotation,
      },
    }));
  };

  // Handle rotation end
  const handleRotateEnd = () => {
    setIsRotating(false);
  };

  // Handle double tap to open menu — don't stop drift
  const handleDoubleTap = (x: number, y: number) => {
    // Only respond to double tap if not currently rotating
    if (isRotating) return;

    setMenuPosition({ x, y });
    setShowMenu(true);
  };

  return (
    <GestureHandler
      onPan={handlePan}
      onPanStart={handlePanStart}
      onPanEnd={handlePanEnd}
      onPinch={handlePinch}
      onRotate={handleRotate}
      onRotateStart={handleRotateStart}
      onRotateEnd={handleRotateEnd}
      onDoubleTap={handleDoubleTap}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full canvas-container"
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <WebGLCanvas
            ref={webglCanvasRef}
            width={dimensions.width}
            height={dimensions.height}
            settings={settings}
            offset={offset}
          />
        )}

        {/* Interaction layer */}
        <div
          ref={interactionLayerRef}
          className="absolute inset-0 interaction-layer"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />

        {/* Control Panel */}
        {showMenu && (
          <ControlPanel
            position={menuPosition}
            settings={settings}
            setSettings={setSettings}
            getSnapshot={getSnapshot}
            onClose={() => setShowMenu(false)}
            initializeAudio={initializeAudio}
          />
        )}

        {/* Visual indicator for rotation (optional) */}
        {isRotating && (
          <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded-md font-bold z-50">
            Rotating
          </div>
        )}
      </div>
    </GestureHandler>
  );
};

export default Canvas;
