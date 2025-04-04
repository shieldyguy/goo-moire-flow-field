# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/54b38eb4-6add-4724-b814-4b67013400fe

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/54b38eb4-6add-4724-b814-4b67013400fe) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/54b38eb4-6add-4724-b814-4b67013400fe) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes it is!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## What does this app do?

This is an interactive Moiré pattern generator with a "goo" effect. The app creates mesmerizing visual patterns by combining two layers of dot grids with different rotations and colors. Here's how it works:

- **Interactive Pattern Generation**: The app creates two layers of dot grids that can be moved relative to each other, creating dynamic Moiré patterns
- **Customizable Parameters**: Users can adjust:
  - Dot spacing and size for each layer
  - Rotation angles for each grid
  - Colors for each layer
  - Goo effect parameters (blur and threshold)
  - Resolution/decimation for pixelation effects
- **Interactive Controls**:
  - Drag to move the top layer and create dynamic patterns
  - Double-click/tap to open a control panel for adjusting parameters
  - Responsive design that works on both desktop and mobile devices
- **Visual Effects**:
  - Real-time pattern generation using HTML5 Canvas
  - Custom "goo" effect that creates fluid, organic-looking patterns
  - Resolution control for creating pixelated or smooth effects

The app uses modern web technologies including React, TypeScript, and Canvas API to create these interactive visual experiences. The patterns are generated in real-time and respond to user interaction, making it both a creative tool and a mesmerizing visual experience.

## Development Journal: Canvas to WebGL Transition

### Why WebGL?
Our original implementation used Canvas 2D API with blur and threshold operations to create the "goo" effect. While functional, this approach faced several challenges:
- Performance issues, especially on mobile devices
- Inconsistent behavior across different browsers
- High memory usage due to multiple canvas operations
- CPU-intensive rendering pipeline

WebGL offers several advantages:
- GPU-accelerated rendering
- Consistent cross-platform behavior
- More efficient memory usage
- Shader-based effects that are more performant than Canvas filters
- Fine-grained control over the rendering pipeline

### Implementation Phases

#### Phase 1: WebGL Foundation (Minimal Viable Product)
**Goal**: Basic WebGL setup while maintaining existing functionality
- Create WebGL context alongside existing Canvas
- Implement basic dot rendering in WebGL (single layer)
- Keep Canvas implementation functional as fallback
- Set up basic shader infrastructure
- Success criteria: Single layer of dots visible using WebGL

**Why this first?**
- Establishes core WebGL infrastructure
- Allows early testing of WebGL compatibility
- Maintains working app during transition
- Provides foundation for more complex features

#### Phase 2: Shader-Based Goo Effect
**Goal**: Implement core visual effect in WebGL
- Develop fragment shader for gaussian blur
- Implement threshold effect in shader
- Set up framebuffer objects for post-processing
- Create ping-pong buffer system for multi-pass effects
- Success criteria: Working goo effect on single layer

**Why this second?**
- Validates core effect feasibility in WebGL
- Establishes performance baseline
- Critical for ensuring visual quality matches original

#### Phase 3: Dual Layer System
**Goal**: Full pattern generation system
- Implement second dot layer
- Set up proper blending between layers
- Maintain separate transformations
- Implement efficient instancing for dots
- Success criteria: Both layers visible with proper interaction

**Why this third?**
- Builds on stable single-layer system
- Tests performance with full pattern complexity
- Validates pattern generation approach

#### Phase 4: Interaction Integration
**Goal**: Maintain smooth user experience
- Port drag functionality to WebGL coordinate system
- Implement proper touch event handling
- Ensure responsive behavior across devices
- Add WebGL-specific optimizations for touch
- Success criteria: Smooth dragging on all devices

**Why this fourth?**
- Critical for user experience
- Requires stable rendering system
- Can be optimized with WebGL specifics

#### Phase 5: Controls and Polish
**Goal**: Feature complete transition
- Update control panel for WebGL parameters
- Add shader-specific controls
- Implement performance monitoring
- Add fallback system for WebGL failure
- Success criteria: Full feature parity with original

**Why this last?**
- Requires all core systems in place
- Allows for fine-tuning based on real usage
- Can incorporate user feedback

### Technical Details

#### WebGL Architecture
- **Render Pipeline**:
  1. Vertex shader for dot positioning and scaling
  2. Fragment shader for dot rendering
  3. Post-processing shaders for goo effect
  - Gaussian blur pass
  - Threshold pass with smooth interpolation
  - Final composition pass

- **Buffer Strategy**:
  - Vertex buffer for dot positions
  - Uniform buffers for transformations
  - Framebuffers for post-processing
  - Ping-pong buffers for multi-pass effects

#### Performance Optimizations
- Instanced rendering for dots
- Texture atlasing for patterns
- Viewport-based culling
- Dynamic quality scaling
- Efficient uniform updates
- Minimized state changes

#### Mobile Considerations
- Touch event optimization
- Device capability detection
- Automatic quality adjustment
- Power-aware rendering
- Fallback mechanisms

### Progress Tracking
We'll update this section as we complete each phase, documenting:
- Completed features
- Performance metrics
- Challenges encountered
- Solutions implemented
- Lessons learned
