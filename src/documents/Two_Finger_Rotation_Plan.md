# Two-Finger Rotation Implementation Plan

## Overview
This document outlines the plan for implementing two-finger rotation of the top pattern layer using our existing Hammer.js integration. The goal is to allow users to directly manipulate the rotation of the top pattern layer through intuitive touch gestures while ensuring proper interaction with our existing double-tap functionality.

## Key Requirements
- Implement two-finger rotation of the top pattern layer
- Fix conflict with double-tap gesture that shows the control panel
- Maintain consistency with the existing rotation parameter
- Make minimal changes to the codebase
- Ensure presets capture rotation adjustments made via gestures

## Implementation Steps

### Step 1: Modify GestureHandler Component
Update our existing GestureHandler.tsx to better handle multi-touch interactions:

```typescript
// In GestureHandler.tsx

// 1. Enhance the useEffect hook that initializes Hammer.js
useEffect(() => {
  if (!containerRef.current || !window.Hammer) return;

  const hammer = new window.Hammer(containerRef.current);
  
  // Enable recognition of all directions for pan
  hammer.get('pan').set({ direction: window.Hammer.DIRECTION_ALL });
  
  // Better configure pinch and rotate for multi-touch
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
  
  // Set up pan handler
  hammer.on('pan', (e) => {
    onPan(e.deltaX, e.deltaY);
  });
  
  // Set up pinch handler
  hammer.on('pinch', (e) => {
    onPinch(e.scale);
  });
  
  // Enhanced rotate handlers
  hammer.on('rotatestart', (e) => {
    if (onRotateStart) onRotateStart();
  });
  
  hammer.on('rotate', (e) => {
    // Convert Hammer rotation (radians) to degrees
    const rotationDegrees = e.rotation * 180 / Math.PI;
    onRotate(rotationDegrees);
  });
  
  hammer.on('rotateend', (e) => {
    if (onRotateEnd) onRotateEnd();
  });
  
  // Set up double-tap handler
  hammer.on('doubletap', (e) => {
    onDoubleTap(e.center.x, e.center.y);
  });
  
  // Clean up on unmount
  return () => {
    hammer.destroy();
  };
}, [onPan, onPinch, onRotate, onDoubleTap, onRotateStart, onRotateEnd]);
```

### Step 2: Update GestureHandler Interface
Expand the props interface to include rotation events:

```typescript
// In GestureHandler.tsx

interface GestureHandlerProps {
  onPan: (deltaX: number, deltaY: number) => void;
  onPinch: (scale: number) => void;
  onRotate: (rotationDegrees: number) => void;
  onRotateStart?: () => void;
  onRotateEnd?: () => void;
  onDoubleTap: (x: number, y: number) => void;
  children: React.ReactNode;
}
```

### Step 3: Modify Canvas Component to Handle Rotation
Update the Canvas component to properly handle rotation gestures:

```typescript
// In Canvas.tsx

// 1. Add state to track initial rotation when gesture starts
const [initialRotation, setInitialRotation] = useState(0);

// 2. Add handlers for rotation
const handleRotateStart = () => {
  // Store current rotation as starting point
  setInitialRotation(settings.layer2.rotation);
};

const handleRotate = (rotationDegrees: number) => {
  // Calculate new rotation based on initial rotation and gesture
  // Note: We want relative rotation from gesture start, not absolute rotation
  const newRotation = (initialRotation + rotationDegrees) % 360;
  
  // Only update layer2 (the top layer)
  setSettings(prev => ({
    ...prev,
    layer2: {
      ...prev.layer2,
      rotation: newRotation
    }
  }));
};

// 3. Pass rotation handlers to GestureHandler
return (
  <GestureHandler
    onPan={handlePan}
    onPinch={handlePinch}
    onRotate={handleRotate}
    onRotateStart={handleRotateStart}
    onDoubleTap={handleDoubleClick}
  >
    {/* Existing canvas content */}
  </GestureHandler>
);
```

### Step 4: Add Simple Visual Feedback (Optional)
Add minimal visual feedback to indicate rotation is happening:

```typescript
// In Canvas.tsx

// 1. Add state to track if rotation is active
const [isRotating, setIsRotating] = useState(false);

// 2. Update handlers
const handleRotateStart = () => {
  setInitialRotation(settings.layer2.rotation);
  setIsRotating(true);
};

const handleRotateEnd = () => {
  setIsRotating(false);
};

// 3. Add optional visual indicator
return (
  <>
    <GestureHandler
      onPan={handlePan}
      onPinch={handlePinch}
      onRotate={handleRotate}
      onRotateStart={handleRotateStart}
      onRotateEnd={handleRotateEnd}
      onDoubleTap={handleDoubleClick}
    >
      {/* Existing canvas content */}
    </GestureHandler>
    
    {isRotating && (
      <div className="fixed top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
        Rotating
      </div>
    )}
  </>
);
```

## Testing Approach

We'll implement and test these changes incrementally:

### Test Phase 1: Double-Tap Improvements
1. Implement the improved double-tap configuration
2. Test double-tap with various timing and movements
3. Verify that rapid "flam" double-taps are ignored
4. Confirm that the control panel opens as expected with proper double-taps

### Test Phase 2: Multi-Touch Recognition
1. Implement the multi-pointer detection
2. Test with two fingers on the screen
3. Verify that double-tap recognition is disabled during multi-touch
4. Confirm that the control panel doesn't open during two-finger gestures

### Test Phase 3: Rotation Gesture
1. Implement rotation handlers
2. Test rotation with two fingers
3. Verify that the top pattern layer rotates as expected
4. Confirm that the rotation value is properly updated

### Test Phase 4: Integrated Testing
1. Test all gestures together
2. Verify smooth transitions between different interactions
3. Confirm that rotation settings are preserved in the control panel
4. Test saving and loading presets with rotation applied via gestures

## Success Criteria
- ✅ Two-finger rotation correctly rotates the top pattern layer
- ✅ Double-tap conflicts are resolved
- ✅ Control panel shows correct rotation value after gesture interaction
- ✅ Rotation via gesture is properly saved in presets
- ✅ Touch interactions feel responsive and natural

## Future Enhancements (Post-Implementation)
- Add user preference to enable/disable rotation gestures
- Implement rotation sensitivity setting
- Add optional "snapping" to common angles (0°, 45°, 90°, etc.)
- Consider adding undo/redo for gesture-based changes 