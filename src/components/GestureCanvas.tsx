import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import WebGLCanvas from './WebGLCanvas';

interface GestureCanvasProps {
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
      blur: number;
      threshold: number;
      prePixelate: number;
      postPixelate: number;
    };
    touch: {
      enablePinchRotate: boolean;
      enablePinchZoom: boolean;
      rotationSensitivity: number;
      zoomSensitivity: number;
    };
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  offset: {
    x: number;
    y: number;
  };
}

const GestureCanvas: React.FC<GestureCanvasProps> = ({
  width,
  height,
  settings,
  setSettings,
  offset
}) => {
  // Motion values for tracking gestures
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const [isGesturing, setIsGesturing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Transform functions for sensitivity
  const rotationSensitivity = useTransform(
    rotate,
    (r) => (r * settings.touch.rotationSensitivity) / 50
  );

  const scaleSensitivity = useTransform(
    scale,
    (s) => (s * settings.touch.zoomSensitivity) / 50
  );

  // Handle gesture updates
  const handleGestureUpdate = () => {
    if (!settings.touch.enablePinchRotate && !settings.touch.enablePinchZoom) return;

    const currentScale = scale.get();
    const currentRotation = rotate.get();

    // Update layer settings based on gestures
    if (settings.touch.enablePinchZoom) {
      const scaleFactor = currentScale;
      setSettings(prev => ({
        ...prev,
        layer2: {
          ...prev.layer2,
          spacing: prev.layer2.spacing * scaleFactor,
          size: prev.layer2.size * scaleFactor
        }
      }));
    }

    if (settings.touch.enablePinchRotate) {
      setSettings(prev => ({
        ...prev,
        layer2: {
          ...prev.layer2,
          rotation: prev.layer2.rotation + currentRotation
        }
      }));
    }

    // Reset motion values after update
    scale.set(1);
    rotate.set(0);
  };

  // Handle combined gesture for mobile
  const handleGesture = (event: PointerEvent, info: PanInfo) => {
    if (!isMobile) return;
    
    // Get touch points
    const touches = (event as any).touches;
    if (!touches || touches.length !== 2) return;

    // Calculate midpoint and angle between touches
    const touch1 = touches[0];
    const touch2 = touches[1];
    const midX = (touch1.clientX + touch2.clientX) / 2;
    const midY = (touch1.clientY + touch2.clientY) / 2;
    const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);

    // Calculate scale and rotation
    const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    const initialDistance = (info as any).initialDistance || distance;
    const scaleFactor = distance / initialDistance;
    
    if (settings.touch.enablePinchZoom) {
      scale.set(scaleFactor);
    }
    
    if (settings.touch.enablePinchRotate) {
      const initialAngle = (info as any).initialAngle || angle;
      const rotationDelta = angle - initialAngle;
      rotate.set(rotationDelta * (180 / Math.PI));
    }
  };

  // Handle wheel event for desktop zoom
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isMobile || !settings.touch.enablePinchZoom) return;
    event.preventDefault();
    const delta = event.deltaY;
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    scale.set(scale.get() * zoomFactor);
  };

  return (
    <motion.div
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none'
      }}
      onPanStart={(event, info) => {
        setIsGesturing(true);
        if (isMobile) {
          const touches = (event as any).touches;
          if (touches && touches.length === 2) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
            (info as any).initialDistance = distance;
            (info as any).initialAngle = angle;
          }
        }
      }}
      onPanEnd={() => {
        setIsGesturing(false);
        handleGestureUpdate();
      }}
      onPan={handleGesture}
      onWheel={handleWheel}
    >
      <WebGLCanvas
        width={width}
        height={height}
        settings={settings}
        offset={offset}
      />
    </motion.div>
  );
};

export default GestureCanvas; 