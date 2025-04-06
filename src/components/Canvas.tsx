import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import ControlPanel from './ControlPanel';
import Renderer from './Renderer';
import { encodePreset } from '@/lib/encoding/presetEncoder';
import interact from 'interactjs';

// We no longer need the throttle hook as we'll move throttling to the renderer
interface CanvasProps {
  // Default values for our parameters
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
  // State for layout and dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // State for interactions
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  const [initialLayerRotation, setInitialLayerRotation] = useState(0);
  
  // Refs for interaction handling
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastClickTimeRef = useRef(0);
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  const initialOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  
  // Utilities
  const { toast } = useToast();
  
  // Check WebGL support
  const [webglSupported, setWebglSupported] = useState(false);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    setWebglSupported(!!gl);
  }, []);

  // Handle resize and device pixel ratio
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Ensure dimensions are at least 1x1 pixels
      const safeWidth = Math.max(1, Math.floor(rect.width * dpr));
      const safeHeight = Math.max(1, Math.floor(rect.height * dpr));
      
      setDimensions({
        width: safeWidth,
        height: safeHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Setup interact.js
  useEffect(() => {
    const interactionElement = interactionLayerRef.current;
    if (!interactionElement) return;

    // Store data for gesture tracking
    let gestureStartAngle = 0;
    let gestureStartRotation = 0;
    let gestureStartScale = 1;
    let initialSpacing = settings.layer2.spacing;
    let initialSize = settings.layer2.size;
    let lastTapTime = 0;
    
    // Create a stable reference to current offset
    initialOffsetRef.current = offset;
    
    // Track accumulated movement during drag
    let dx = 0;
    let dy = 0;

    // Setup the interactable
    const interactable = interact(interactionElement)
      // Enable dragging
      .draggable({
        inertia: false,
        modifiers: [],
        enabled: true,
        autoScroll: true,
        listeners: {
          start(event) {
            // Reset accumulated movement
            dx = 0;
            dy = 0;
            
            // Store initial offset at drag start
            initialOffsetRef.current = { ...offset };
            isDraggingRef.current = true;
            setIsDragging(true);
          },
          move(event) {
            // Accumulate the movement
            dx += event.dx;
            dy += event.dy;
            
            // Update directly without throttling - throttling happens in renderer
            if (isDraggingRef.current && !isRotating) {
              setOffset({
                x: initialOffsetRef.current.x + dx,
                y: initialOffsetRef.current.y + dy
              });
            }
          },
          end() {
            isDraggingRef.current = false;
            setIsDragging(false);
          }
        }
      });

    // Add separate tap recognizer with specific config
    interactable.on('tap', (event) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime;
      
      // Check for double-tap (within 300ms)
      if (timeDiff < 300) {
        setShowMenu(true);
        setMenuPosition({ 
          x: event.clientX || event.pageX, 
          y: event.clientY || event.pageY 
        });
      }
      
      // Close menu if it's open and we tap outside
      if (showMenu) {
        setShowMenu(false);
      }
      
      lastTapTime = currentTime;
    });

    // Setup gesture recognition for rotation and pinch
    interactable.gesturable({
      listeners: {
        start(event) {
          // When starting a gesture, pause any ongoing drag
          if (isDraggingRef.current) {
            // Save the current drag position before starting rotation
            initialOffsetRef.current = { ...offset };
          }
          
          // Prevent drag during gestures
          isDraggingRef.current = false;
          setIsDragging(false);
          
          // Store initial values for gesture
          if (settings.touch?.enablePinchRotate) {
            setIsRotating(true);
            setInitialLayerRotation(settings.layer2.rotation);
            gestureStartAngle = event.angle;
            gestureStartRotation = settings.layer2.rotation;
          }
          
          // Store initial values for pinch zoom
          if (settings.touch?.enablePinchZoom) {
            gestureStartScale = event.scale;
            initialSpacing = settings.layer2.spacing;
            initialSize = settings.layer2.size;
          }
        },
        move(event) {
          // Handle rotation if enabled - direct updates without throttling
          if (isRotating && settings.touch?.enablePinchRotate) {
            // Calculate rotation delta
            const deltaAngle = event.angle - gestureStartAngle;
            
            // Calculate new rotation value
            const newRotation = (gestureStartRotation + deltaAngle) % 360;
            const normalizedRotation = newRotation < 0 ? newRotation + 360 : newRotation;
            
            // Update settings directly
            setSettings(prev => ({
              ...prev,
              layer2: {
                ...prev.layer2,
                rotation: normalizedRotation
              }
            }));
          }
          
          // Handle pinch zoom if enabled - direct updates without throttling
          if (settings.touch?.enablePinchZoom) {
            // Calculate scale relative to gesture start
            const relativeScale = event.scale / gestureStartScale;
            
            // Limit scale between 0.5 and 2.0
            const clampedScale = Math.min(Math.max(relativeScale, 0.5), 2.0);
            
            // Update settings directly
            setSettings(prev => ({
              ...prev,
              layer2: {
                ...prev.layer2,
                spacing: initialSpacing * clampedScale,
                size: initialSize * clampedScale
              }
            }));
          }
        },
        end() {
          setIsRotating(false);
          
          // Allow dragging to resume after gesture ends
          // but don't automatically start dragging
        }
      }
    });

    // Manually handle double-click for desktop browsers
    const handleDoubleClick = (e: MouseEvent) => {
      setShowMenu(true);
      setMenuPosition({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    };
    
    interactionElement.addEventListener('dblclick', handleDoubleClick);

    // Clean up interactable when component unmounts
    return () => {
      interactable.unset();
      interactionElement.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [settings, isRotating, setSettings]);

  // Remove legacy mouse handlers, we'll rely on Interact.js for everything
  const handleMenuClose = () => {
    setShowMenu(false);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full canvas-container">
      {/* Pattern Renderer - frame rate throttling happens here */}
      <Renderer
        width={dimensions.width}
        height={dimensions.height}
        settings={settings}
        offset={offset}
        targetFps={12} // Add target FPS prop - this is where throttling happens
      />

      {/* Interaction layer */}
      <div
        ref={interactionLayerRef}
        className="absolute inset-0 interaction-layer"
        style={{
          touchAction: 'none', // Disable browser handling of gestures
          cursor: isDragging ? 'grabbing' : 'grab', // Visual feedback for dragging
          zIndex: 10, // Ensure it's above other elements but below UI
          userSelect: 'none', // Prevent text selection during interactions
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      />

      {/* Control Panel */}
      {showMenu && (
        <ControlPanel
          position={menuPosition}
          settings={settings}
          setSettings={setSettings}
          onClose={handleMenuClose}
        />
      )}

      {/* Visual indicator for rotation (optional) */}
      {isRotating && (
        <div className="fixed top-4 right-4 bg-black/80 text-white px-4 py-2 rounded-md font-bold z-50">
          Rotating
        </div>
      )}
    </div>
  );
};

export default Canvas;
