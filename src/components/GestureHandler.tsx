import React, { useRef, useEffect, useState, CSSProperties } from 'react';

interface GestureHandlerProps {
  onPan: (deltaX: number, deltaY: number) => void;
  onPinch: (scale: number) => void;
  onRotate: (rotation: number) => void;
  onRotateStart?: () => void;
  onRotateEnd?: () => void;
  onDoubleTap: (x: number, y: number) => void;
  children: React.ReactNode;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({
  onPan,
  onPinch,
  onRotate,
  onRotateStart,
  onRotateEnd,
  onDoubleTap,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.Hammer) return;

    const hammer = new window.Hammer(containerRef.current);
    
    // Configure gestures
    hammer.get('pan').set({ direction: window.Hammer.DIRECTION_ALL });
    hammer.get('pinch').set({ enable: true });
    hammer.get('rotate').set({ enable: true });
    
    // Improve double-tap recognition to avoid conflicts
    const doubleTap = new window.Hammer.Tap({
      event: 'doubletap',
      taps: 2,
      interval: 300,      // Minimum ms between taps (prevent "flam" recognition)
      threshold: 10,      // Maximum px movement allowed between taps
      posThreshold: 20    // Maximum px movement during a tap
    });
    hammer.add(doubleTap);
    
    // Disable double-tap when multiple pointers are detected
    hammer.on('hammer.input', function(ev) {
      if (ev.pointers.length > 1) {
        hammer.get('doubletap').set({ enable: false });
      } else {
        hammer.get('doubletap').set({ enable: true });
      }
    });
    
    // Add event handlers
    hammer.on('pan', (e) => {
      onPan(e.deltaX, e.deltaY);
    });

    hammer.on('pinch', (e) => {
      onPinch(e.scale);
    });

    // Enhanced rotation handlers
    hammer.on('rotatestart', () => {
      setIsRotating(true);
      onRotateStart?.();
    });

    hammer.on('rotate', (e) => {
      onRotate(e.rotation);
    });

    hammer.on('rotateend', () => {
      setIsRotating(false);
      onRotateEnd?.();
    });
    
    hammer.on('doubletap', (e) => {
      onDoubleTap(e.center.x, e.center.y);
    });

    return () => {
      hammer.destroy();
    };
  }, [onPan, onPinch, onRotate, onRotateStart, onRotateEnd, onDoubleTap]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {children}
      {isRotating && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '14px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1000,
        }}>
          Rotating...
        </div>
      )}
    </div>
  );
};

export default GestureHandler; 