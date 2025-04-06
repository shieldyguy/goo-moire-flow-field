# Rotation Gesture Implementation Plan

## Goals
- Implement two-finger rotation gestures to control layer2 rotation
- Maintain simultaneous pan + rotation capability
- Keep rotation state in sync with control panel

## Architecture Overview

### Component Relationships
1. **Parent Component**
   - Holds the source of truth (`settings` object)
   - Passes settings to WebGLCanvas and ControlPanel
   - Will connect GestureHandler events to settings updates

2. **WebGLCanvas.tsx**
   - Renders layers using rotation value from settings
   - Already handles offset for layer2

3. **GestureHandler.tsx**
   - Detects pan and rotation gestures
   - Provides callbacks to parent component

4. **ControlPanel.tsx**
   - Provides UI for changing rotation
   - Contains enablePinchRotate toggle
   - Will stay in sync with gesture-based rotation

## Implementation Details

### Rotation Data Flow
1. When rotation gesture starts:
   - Store the initial layer2 rotation value
   - Call `onRotateStart` handler

2. During rotation:
   - Calculate new rotation = (initial rotation + gesture delta)
   - Ensure value stays in 0-360° range using modulo
   - Update settings.layer2.rotation
   - This triggers WebGLCanvas re-render
   - Control panel reflects the new value

3. When rotation ends:
   - Call `onRotateEnd` handler
   - No special cleanup needed

### Pan + Rotation Coordination
1. Both gestures work simultaneously:
   - Pan updates offset.x and offset.y
   - Rotation updates layer2.rotation
   - Both can happen during the same multi-touch gesture

2. No artificial isolation:
   - Allow natural, fluid manipulation like Procreate/Illustrator
   - No threshold or prioritization between gestures

### User Preferences
1. Respect enablePinchRotate setting:
   - Check settings.touch.enablePinchRotate before applying rotation
   - If disabled, ignore rotation component of gestures
   - Pan should still work regardless

2. Manual + gesture interaction:
   - Users can adjust via control panel slider or gestures
   - Changes are reflected in both places

### Technical Considerations

1. Angle handling:
   - Keep angles in 0-360° range for consistency with control panel
   - Handle wraparound at 0°/360° boundary smoothly
   - Use relative rotation (delta from start) for natural feel

2. Frame rate:
   - Maintain existing 12fps rendering
   - Don't introduce additional render cycles

## Implementation Steps

1. Add rotation state tracking to parent component:
   - Add rotation start/change/end handlers
   - Track initial rotation state

2. Connect gesture events:
   - Pass handlers to GestureHandler
   - Update settings when rotation occurs
   - Check enablePinchRotate before applying

3. Test rotation + pan combinations:
   - Verify simultaneous gestures work smoothly
   - Check that control panel stays in sync
   - Verify enabling/disabling via settings works

## Future Enhancements (Not in current scope)
- Pinch/zoom integration
- Enhanced visual feedback for gestures
- Additional gesture types 