# Interact.js Implementation Plan

## Goals
- Replace Hammer.js with Interact.js for all gesture handling
- Implement drag, double-tap, rotation, and pinch gestures
- Keep rotation state in sync with control panel

## Overview of Changes

### 1. Remove Hammer.js Dependencies
- Delete GestureHandler.tsx component that uses Hammer.js
- Remove Hammer.js type definitions
- Clean up any Hammer.js-specific code in Canvas component

### 2. Integrate Interact.js

#### Installation
```bash
npm install interactjs
```

#### TypeScript Integration
- Add proper TypeScript typings (already included in the package)

### 3. New Architecture

#### Direct Integration in Canvas Component
- Apply Interact.js directly to the interaction layer in Canvas.tsx
- Handle all gestures within Canvas.tsx without a wrapper component
- Connect gesture events directly to state updates

### Implementation Steps

## Step 1: Remove Hammer.js
1. Delete the GestureHandler.tsx component
2. Remove Hammer.js types from global.d.ts
3. Remove references to GestureHandler in Canvas.tsx

## Step 2: Implement Interact.js Gestures

### Basic Setup
1. Import Interact.js in Canvas.tsx
2. Initialize interact on the interaction layer div
3. Implement the base interactable object

### Drag Implementation
1. Set up draggable functionality with interact
2. Connect drag events to update offset state
3. Ensure drag throttling is applied for performance

### Double-Tap Implementation
1. Set up tap gesture recognition
2. Configure for double-tap detection
3. Connect to menu opening/closing functionality

### Rotation Implementation
1. Set up rotation gesture recognition
2. Store initial rotation angle when gesture starts
3. Update rotation value in settings during gesture
4. Apply proper angle normalization (0-360°)
5. Respect the enablePinchRotate setting

### Gesture Coordination
1. Ensure multiple gestures can happen simultaneously
2. Configure proper event listener options
3. Handle touch vs mouse events appropriately

## Step 3: Integration with Existing UI
1. Ensure rotation updates are reflected in control panel
2. Update visual feedback for gestures 
3. Maintain the same 12fps throttling for performance

## Implementation Notes

### Angle Handling
- Use proper angle normalization for 0-360° range
- Handle rotation smoothly when crossing boundaries
- Apply relative rotation for natural gesture feel

### Performance Considerations
- Maintain existing throttling approach
- Use efficient event handlers

### Future Work (Out of Scope)
- Additional gesture types
- Enhanced visual feedback
- Advanced gesture configurations 