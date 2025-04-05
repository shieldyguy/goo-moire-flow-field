# Pattern Enhancement Plan

## Overview
This document outlines the plan for enhancing the pattern generation system with new pattern types and improved parameter controls.

## Pattern Types & Parameters

### Current Patterns
- Dots
- Lines

### New Patterns
- Concentric squares
- Concentric circles
- Concentric triangles

### Parameters
- `density` (renamed from `spacing` - controls overall pattern density)
- `spacing` (new - controls distance between concentric elements)
- `size` (existing - controls element size)
- `rotation` (existing - controls pattern rotation)
- `color` (existing - controls element color)

## Control Panel Updates
- Add new pattern type selector (dropdown/radio)
- Add new "spacing" control that appears only for concentric patterns
- Rename "spacing" to "density" in UI
- Potentially reorganize controls to group related parameters

## WebGLCanvas Updates
- Add new rendering functions for each pattern type
- Handle conditional rendering based on pattern type
- Ensure proper scaling and rotation for all patterns
- Consider performance implications of concentric patterns

## Preset Encoder Updates
- Add new pattern types to type definitions
- Update default values
- Handle backward compatibility:
  - Old presets should default to "dots"
  - Missing spacing values should use sensible defaults
  - Ensure type safety throughout

## Development Phases

### Phase 1: Foundation
- [ ] Update type definitions in presetEncoder
- [ ] Add backward compatibility handling
- [ ] Rename spacing to density in codebase
- [ ] Add new pattern type enum/type

### Phase 2: Control Panel
- [ ] Update UI to show new pattern types
- [ ] Add conditional spacing control
- [ ] Rename spacing to density in UI
- [ ] Test pattern switching

### Phase 3: Rendering
- [ ] Implement concentric square rendering
- [ ] Implement concentric circle rendering
- [ ] Implement concentric triangle rendering
- [ ] Test each pattern type independently

### Phase 4: Integration
- [ ] Connect pattern selection to rendering
- [ ] Test pattern transitions
- [ ] Verify preset saving/loading
- [ ] Performance testing

### Phase 5: Polish
- [ ] UI/UX refinements
- [ ] Animation transitions between patterns
- [ ] Error handling
- [ ] Documentation updates

## Technical Considerations
- Performance impact of concentric patterns
- Memory usage for complex patterns
- Smooth transitions between pattern types
- Touch/mouse interaction behavior
- Responsive design considerations

## Backward Compatibility Strategy
- Add version field to presets
- Handle missing pattern types gracefully
- Provide sensible defaults for new parameters
- Maintain existing preset functionality

## Testing Plan
- Unit tests for new pattern rendering
- Integration tests for preset handling
- Performance benchmarks
- Cross-browser testing
- Mobile device testing

## Notes
- Consider adding visual previews for pattern types
- Document performance characteristics of each pattern type
- Consider adding pattern-specific presets
- Plan for future pattern additions 