import React, { useRef, useEffect } from 'react';

interface GestureHandlerProps {
  onPan: (deltaX: number, deltaY: number) => void;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  onPinch: (scale: number) => void;
  onRotate: (rotation: number) => void;
  onRotateStart?: () => void;
  onRotateEnd?: () => void;
  onDoubleTap: (x: number, y: number) => void;
  children: React.ReactNode;
}

const GestureHandler: React.FC<GestureHandlerProps> = ({
  onPan,
  onPanStart,
  onPanEnd,
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
    
    // Simple Hammer instance
    const hammer = new window.Hammer(containerRef.current);
    
    // Enable necessary recognizers
    hammer.get('pan').set({ direction: window.Hammer.DIRECTION_ALL });
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
    
    // Handle pan
    hammer.on('panstart', () => {
      if (!isMultiTouch) {
        onPanStart?.();
      }
    });

    hammer.on('pan', (e) => {
      if (!isMultiTouch) {
        onPan(e.deltaX, e.deltaY);
      }
    });

    hammer.on('panend', () => {
      if (!isMultiTouch) {
        onPanEnd?.();
      }
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
  }, [onPan, onPanStart, onPanEnd, onPinch, onRotate, onRotateStart, onRotateEnd, onDoubleTap]);
  
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
    </div>
  );
};

export default GestureHandler; 