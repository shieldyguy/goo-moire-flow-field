import React, { useRef, useEffect, useState } from 'react';

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
  const multiTouchActiveRef = useRef(false);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current || !window.Hammer) return;

    const doubleTapDelay = 200; // Window for double-tap detection
    const doubleTapMoveTolerance = 10; // Movement tolerance
    
    const hammer = new window.Hammer(containerRef.current);
    
    // Configure gestures
    hammer.get('pan').set({ direction: window.Hammer.DIRECTION_ALL });
    hammer.get('pinch').set({ enable: true });
    hammer.get('rotate').set({ 
      enable: true,
      threshold: 1  // Minimal threshold for immediate rotation detection
    });
    hammer.get('tap').set({ 
      enable: true,
      taps: 2,
      interval: doubleTapDelay,
      threshold: doubleTapMoveTolerance,
      posThreshold: doubleTapMoveTolerance
    });
    
    // Detect multi-touch immediately
    hammer.on('hammer.input', function(e) {
      // As soon as we detect multiple pointers, enter multi-touch mode
      if (e.pointers.length > 1) {
        multiTouchActiveRef.current = true;
      } 
      // Only exit multi-touch mode when all touches are lifted
      else if (e.isFinal) {
        multiTouchActiveRef.current = false;
      }
    });
    
    // Handle double tap - only allow when not in multi-touch mode
    hammer.on('tap', function(e) {
      // Immediately reject any double-taps during multi-touch
      if (multiTouchActiveRef.current) {
        return;
      }
      
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapTimeRef.current;
      
      if (timeSinceLastTap <= doubleTapDelay && e.tapCount === 2) {
        onDoubleTap?.(e.center.x, e.center.y);
      }
      
      lastTapTimeRef.current = currentTime;
    });
    
    // Handle pan only in single-touch mode
    hammer.on('pan', (e) => {
      if (!multiTouchActiveRef.current) {
        onPan(e.deltaX, e.deltaY);
      }
    });

    // Multi-touch gestures
    hammer.on('pinch', (e) => {
      if (multiTouchActiveRef.current) {
        onPinch(e.scale);
      }
    });

    // Rotation handling - immediate response
    hammer.on('rotatestart', (e) => {
      console.log('ROTATION START detected');
      setIsRotating(true);
      onRotateStart?.();
    });

    hammer.on('rotate', (e) => {
      if (multiTouchActiveRef.current) {
        // Dump all rotation-related properties for debugging
        console.log('ROTATION EVENT', {
          rotation: e.rotation,
          velocity: e.velocity,
          direction: e.direction,
          center: e.center,
          pointers: e.pointers.length
        });
        
        // Directly pass the rotation value
        onRotate(e.rotation);
      }
    });

    hammer.on('rotateend', (e) => {
      setIsRotating(false);
      onRotateEnd?.();
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