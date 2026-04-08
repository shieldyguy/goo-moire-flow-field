import React, { useRef, useEffect } from 'react';

interface GestureHandlerProps {
  onPinch: (scale: number) => void;
  onRotate: (rotation: number) => void;
  onRotateStart?: () => void;
  onRotateEnd?: () => void;
  onDoubleTap: (x: number, y: number) => void;
  children: React.ReactNode;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({
  onPinch,
  onRotate,
  onRotateStart,
  onRotateEnd,
  onDoubleTap,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !window.Hammer) return;
    
    // Touch-only Hammer instance — mouse double-click is handled natively in Canvas
    const hammer = new window.Hammer(containerRef.current, {
      inputClass: window.Hammer.TouchInput,
    });
    
    // Disable single-finger pan — native touch/mouse handlers in Canvas handle
    // drag directly for zero-latency response and smooth drift handoff.
    hammer.get('pan').set({ enable: false });
    hammer.get('pinch').set({ enable: true });
    hammer.get('rotate').set({ enable: true });

    // Add doubletap recognizer
    const doubletap = new window.Hammer.Tap({ event: 'doubletap', taps: 2 });
    hammer.add(doubletap);

    // Simple multi-touch tracking
    let isMultiTouch = false;

    hammer.on('hammer.input', function(e) {
      // Track if multiple fingers are touching
      isMultiTouch = e.pointers.length > 1;
    });

    // Handle pinch
    hammer.on('pinch', (e) => {
      if (isMultiTouch) {
        onPinch(e.scale);
      }
    });
    
    // Handle rotation
    hammer.on('rotatestart', () => {
      onRotateStart?.();
    });
    
    hammer.on('rotate', (e) => {
      if (isMultiTouch) {
        onRotate(e.rotation);
      }
    });
    
    hammer.on('rotateend', () => {
      onRotateEnd?.();
    });
    
    // Handle double tap
    hammer.on('doubletap', (e) => {
      if (!isMultiTouch) {
        onDoubleTap(e.center.x, e.center.y);
      }
    });
    
    return () => {
      hammer.destroy();
    };
  }, [onPinch, onRotate, onRotateStart, onRotateEnd, onDoubleTap]);
  
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
};

export default GestureHandler; 