import React, { useRef, useEffect } from 'react';

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

  useEffect(() => {
    if (!containerRef.current || !window.Hammer) return;
    
    // Create a manager instance instead of a direct Hammer instance
    const hammer = new window.Hammer.Manager(containerRef.current);
    
    // Create recognizers
    const pan = new window.Hammer.Pan({ 
      direction: window.Hammer.DIRECTION_ALL,
      threshold: 0 // Reduce threshold for more immediate response
    });
    
    const rotate = new window.Hammer.Rotate({
      threshold: 0 // Reduce threshold for more responsive rotation
    });
    
    const pinch = new window.Hammer.Pinch();
    
    // Add the rotate and pinch recognizers, which should recognize simultaneously
    const pinchRotate = new window.Hammer.Pinch();
    pinchRotate.recognizeWith(rotate);
    
    // Add the pan recognizer
    hammer.add(pan);
    
    // Add the pinch-rotate recognizers
    hammer.add([pinchRotate, rotate]);
    
    // Add doubletap recognizer
    const doubletap = new window.Hammer.Tap({ event: 'doubletap', taps: 2 });
    hammer.add(doubletap);
    
    // Track multi-touch state
    let isMultiTouch = false;
    
    hammer.on('hammer.input', function(e) {
      isMultiTouch = e.pointers.length > 1;
    });
    
    // Handle pan - works with single or multi-touch
    hammer.on('pan', (e) => {
      onPan(e.deltaX, e.deltaY);
    });
    
    // Handle pinch - only with multi-touch
    hammer.on('pinch', (e) => {
      if (isMultiTouch) {
        onPinch(e.scale);
      }
    });
    
    // Handle rotation - only with multi-touch
    hammer.on('rotatestart', () => {
      if (isMultiTouch && onRotateStart) {
        onRotateStart();
      }
    });
    
    hammer.on('rotate', (e) => {
      if (isMultiTouch) {
        // Pass the rotation value in degrees
        // This is the rotation in degrees, relative to the starting position
        onRotate(e.rotation);
      }
    });
    
    hammer.on('rotateend', () => {
      if (onRotateEnd) {
        onRotateEnd();
      }
    });
    
    // Handle double tap - only with single touch
    hammer.on('doubletap', (e) => {
      if (!isMultiTouch) {
        onDoubleTap(e.center.x, e.center.y);
      }
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
    </div>
  );
};

export default GestureHandler; 