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
import type { MovementData } from "@/lib/encoding/presetEncoder";

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
    };
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  initialMovement?: MovementData;
}

// Function to generate random colors (same as in ControlPanel and Index)
const generateRandomColor = () => {
  // Generate muted, stylish colors instead of fully saturated ones
  const h = Math.floor(Math.random() * 360); // Hue: 0-359
  const s = 40 + Math.floor(Math.random() * 30); // Saturation: 40-69%
  const l = 40 + Math.floor(Math.random() * 20); // Lightness: 40-59%

  return `hsl(${h}, ${s}%, ${l}%)`;
};

const Canvas: React.FC<CanvasProps> = ({ settings, setSettings, initialMovement }) => {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Mirror state to refs so touch handlers (registered once) can read current values
  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;
  const showMenuRef = useRef(false);
  showMenuRef.current = showMenu;
  const offsetRef = useRef({ x: 0, y: 0 });
  offsetRef.current = offset;
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
    settings.goo,
  );

  // Drift animation refs
  const driftAnimRef = useRef<number | null>(null);
  const driftVelocityRef = useRef({ vx: 0, vy: 0 });
  const driftOffsetRef = useRef({ x: 0, y: 0 });
  const lastDriftTimeRef = useRef(0);

  // EMA velocity tracking — replaces sample-based velocity for smooth handoff
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const lastDragTimeRef = useRef(0);
  const VELOCITY_ALPHA = 0.3;

  const getSnapshot = useCallback((): HTMLCanvasElement | null => {
    return webglCanvasRef.current;
  }, []);

  // Expose current movement state so ControlPanel can embed it in presets
  const getMovement = useCallback((): MovementData => {
    const vel = driftVelocityRef.current;
    const off = offsetRef.current;
    return {
      offsetX: off.x,
      offsetY: off.y,
      velocityX: vel.vx,
      velocityY: vel.vy,
    };
  }, []);

  // --- Drift functions ---

  const stopDrift = () => {
    if (driftAnimRef.current !== null) {
      cancelAnimationFrame(driftAnimRef.current);
      driftAnimRef.current = null;
    }
    driftVelocityRef.current = { vx: 0, vy: 0 };
  };

  const startDrift = (vx: number, vy: number) => {
    if (Math.hypot(vx, vy) < 5) return;
    stopDrift();

    driftVelocityRef.current = { vx, vy };
    // Initialize from current rendered offset — no jump possible
    driftOffsetRef.current = { ...offsetRef.current };
    lastDriftTimeRef.current = performance.now();

    const friction = settings.goo.driftFriction ?? 0;

    const tick = (now: number) => {
      let dt = (now - lastDriftTimeRef.current) / 1000;
      if (dt > 0.1) dt = 0.1; // cap for tab backgrounding
      lastDriftTimeRef.current = now;

      const vel = driftVelocityRef.current;

      // Apply friction (frame-rate-independent exponential decay)
      if (friction > 0) {
        const decay = Math.pow(1 - friction / 100, dt * 60);
        vel.vx *= decay;
        vel.vy *= decay;
      }

      driftOffsetRef.current.x += vel.vx * dt;
      driftOffsetRef.current.y += vel.vy * dt;

      setOffset({ x: driftOffsetRef.current.x, y: driftOffsetRef.current.y });

      if (friction > 0 && Math.hypot(vel.vx, vel.vy) < 0.5) {
        driftAnimRef.current = null;
        return;
      }

      driftAnimRef.current = requestAnimationFrame(tick);
    };

    driftAnimRef.current = requestAnimationFrame(tick);
  };

  // Blend instantaneous velocity into EMA for smooth drag→drift transition
  const updateVelocityEma = (newX: number, newY: number) => {
    const now = performance.now();
    const dt = (now - lastDragTimeRef.current) / 1000;
    if (dt > 0.001 && dt < 0.2) {
      const ivx = (newX - lastDragPosRef.current.x) / dt;
      const ivy = (newY - lastDragPosRef.current.y) / dt;
      driftVelocityRef.current.vx += (ivx - driftVelocityRef.current.vx) * VELOCITY_ALPHA;
      driftVelocityRef.current.vy += (ivy - driftVelocityRef.current.vy) * VELOCITY_ALPHA;
    }
    lastDragPosRef.current = { x: newX, y: newY };
    lastDragTimeRef.current = now;
  };

  // On release: if finger was still for >80ms, user intended to stop, not coast
  const releaseDrift = () => {
    const now = performance.now();
    if (now - lastDragTimeRef.current > 80) {
      driftVelocityRef.current = { vx: 0, vy: 0 };
    }
    startDrift(driftVelocityRef.current.vx, driftVelocityRef.current.vy);
  };

  // Cleanup drift rAF on unmount
  useEffect(() => {
    return () => {
      if (driftAnimRef.current !== null) {
        cancelAnimationFrame(driftAnimRef.current);
      }
    };
  }, []);

  // Apply initial movement from a loaded preset (offset + kick off drift)
  const initialMovementApplied = useRef(false);
  useEffect(() => {
    if (initialMovement && !initialMovementApplied.current) {
      initialMovementApplied.current = true;
      const off = { x: initialMovement.offsetX, y: initialMovement.offsetY };
      setOffset(off);
      offsetRef.current = off;
      if (Math.hypot(initialMovement.velocityX, initialMovement.velocityY) > 0.5) {
        startDrift(initialMovement.velocityX, initialMovement.velocityY);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMovement]);

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

    // Close menu if it's open and we click outside (use ref to avoid stale closure)
    if (showMenuRef.current) {
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
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
    }

    lastClickTimeRef.current = currentTime;
  };

  // Native dblclick as a reliable fallback for desktop double-click detection
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showMenuRef.current) {
      setShowMenu(true);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const hasDragMovedRef = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    // Stop drift on first actual move, not on mousedown (preserves drift on double-click)
    if (!hasDragMovedRef.current) {
      stopDrift();
      hasDragMovedRef.current = true;
      // Re-snapshot dragStart so there's no jump from drift advance since mousedown
      dragStartRef.current = {
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
    }

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    updateVelocityEma(newX, newY);
    setOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && hasDragMovedRef.current) {
      releaseDrift();
    }
    setIsDragging(false);
    hasDragMovedRef.current = false;
  };

  // Set up non-passive touch event listeners
  useEffect(() => {
    const interactionLayer = interactionLayerRef.current;
    if (!interactionLayer) return;

    // Read from refs (not closures) so these handlers never need re-registration
    const handleTouchStartEvent = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length > 1) return;

      const touch = e.touches[0];
      const currentTime = new Date().getTime();
      const timeDiff = currentTime - lastClickTimeRef.current;

      if (showMenuRef.current) {
        setShowMenu(false);
        return;
      }

      if (timeDiff < 250 && timeDiff > 50) {
        setMenuPosition({ x: touch.clientX, y: touch.clientY });
        setShowMenu(true);
        return;
      }

      lastClickTimeRef.current = currentTime;

      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - offsetRef.current.x,
        y: touch.clientY - offsetRef.current.y,
      };
    };

    const handleTouchMoveEvent = (e: TouchEvent) => {
      e.preventDefault();

      if (!isDraggingRef.current) return;

      if (!hasDragMovedRef.current) {
        stopDrift();
        hasDragMovedRef.current = true;
        // Re-snapshot dragStart to avoid jump from drift advance since touchstart
        const touch = e.touches[0];
        dragStartRef.current = {
          x: touch.clientX - offsetRef.current.x,
          y: touch.clientY - offsetRef.current.y,
        };
      }

      const touch = e.touches[0];
      const newX = touch.clientX - dragStartRef.current.x;
      const newY = touch.clientY - dragStartRef.current.y;

      updateVelocityEma(newX, newY);
      setOffset({ x: newX, y: newY });
    };

    const handleTouchEndEvent = (e: TouchEvent) => {
      e.preventDefault();
      if (isDraggingRef.current && hasDragMovedRef.current) {
        releaseDrift();
      }
      setIsDragging(false);
      hasDragMovedRef.current = false;
    };

    interactionLayer.addEventListener("touchstart", handleTouchStartEvent, {
      passive: false,
    });
    interactionLayer.addEventListener("touchmove", handleTouchMoveEvent, {
      passive: false,
    });
    interactionLayer.addEventListener("touchend", handleTouchEndEvent, {
      passive: false,
    });

    return () => {
      interactionLayer.removeEventListener("touchstart", handleTouchStartEvent);
      interactionLayer.removeEventListener("touchmove", handleTouchMoveEvent);
      interactionLayer.removeEventListener("touchend", handleTouchEndEvent);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            getMovement={getMovement}
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
