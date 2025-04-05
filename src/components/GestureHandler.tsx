import React, { useRef, useEffect } from 'react';

interface GestureHandlerProps {
  onPan: (deltaX: number, deltaY: number) => void;
  onPinch: (scale: number) => void;
  onRotate: (rotation: number) => void;
  onDoubleTap: (x: number, y: number) => void;
  children: React.ReactNode;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({
  onPan,
  onPinch,
  onRotate,
  onDoubleTap,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !window.Hammer) return;

    const hammer = new window.Hammer(containerRef.current);
    
    // Configure gestures
    hammer.get('pan').set({ direction: window.Hammer.DIRECTION_ALL });
    hammer.get('pinch').set({ enable: true });
    hammer.get('rotate').set({ enable: true });
    
    // Add event handlers
    hammer.on('pan', (e) => {
      onPan(e.deltaX, e.deltaY);
    });

    hammer.on('pinch', (e) => {
      onPinch(e.scale);
    });

    hammer.on('rotate', (e) => {
      onRotate(e.rotation);
    });

    // Configure double tap
    const doubleTap = new window.Hammer.Tap({ event: 'doubletap', taps: 2 });
    hammer.add(doubleTap);
    
    hammer.on('doubletap', (e) => {
      onDoubleTap(e.center.x, e.center.y);
    });

    return () => {
      hammer.destroy();
    };
  }, [onPan, onPinch, onRotate, onDoubleTap]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
};

export default GestureHandler; 