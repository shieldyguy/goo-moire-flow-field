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

### Current Implementation Status
We have successfully implemented a hybrid rendering system that combines both Canvas 2D and WebGL approaches:

1. **Hybrid Rendering System**
   - Automatic detection of WebGL support
   - Fallback to Canvas 2D when WebGL is not available
   - Seamless switching between rendering methods

2. **WebGL Implementation**
   - Basic dot rendering using WebGL
   - Post-processing effects using WebGL filters
   - Performance optimizations for mobile devices
   - Proper handling of device pixel ratio

3. **User Interface**
   - Radial menu for parameter control
   - Touch and mouse interaction support
   - Responsive design for all devices
   - Real-time parameter updates

### Technical Implementation Details

#### Rendering Pipeline
1. **Layer Rendering**
   - Two independent dot grid layers
   - Customizable spacing, size, and rotation
   - Color control for each layer
   - Proper transformation handling

2. **Post-Processing Effects**
   - Gaussian blur implementation
   - Threshold-based goo effect
   - Resolution control for pixelation
   - Multi-pass rendering pipeline

3. **Performance Optimizations**
   - Device pixel ratio scaling
   - Efficient buffer management
   - Viewport-based culling
   - Dynamic quality adjustment

#### Mobile Support
- Touch event handling
- Performance-aware rendering
- Automatic quality scaling
- Power-efficient implementation

### Next Steps
1. **Shader Optimization**
   - Implement more efficient blur algorithms
   - Add additional post-processing effects
   - Optimize fragment shaders

2. **Performance Enhancements**
   - Implement instanced rendering
   - Add texture atlasing
   - Optimize uniform updates

3. **Feature Additions**
   - Add more pattern types
   - Implement pattern presets
   - Add animation capabilities

### Presets Feature Implementation Plan

#### Implementation Progress

##### Phase 1: Binary Encoding System ✅
1. **Binary Structure Definition** ✅
   - Defined bit allocation for each parameter
   - Created type definitions for encoded data
   - Implemented validation for parameter ranges
   - **Discovery**: Using 9 bits for rotation allows full 0-360 range

2. **Core Encoding Functions** ✅
   - Implemented `numberToBinary` and `binaryToNumber`
   - Implemented `colorToBinary` and `binaryToColor`
   - Implemented `createChecksum` for data integrity
   - **Discovery**: Base64 encoding reduces URL length by ~33%

3. **Preset Encoding/Decoding** ✅
   - Implemented `encodePreset` and `decodePreset`
   - Added error handling and validation
   - Implemented versioning system
   - **Gotcha**: Need to handle URL-safe base64 encoding

**Current URL Length**: ~40-50 characters for a complete preset

##### Phase 2: URL Integration ✅
1. **URL Parameter Handling** ✅
   - Added URL parameter parsing on app initialization
   - Implemented automatic settings application from URL
   - Added error handling for invalid/malformed URLs
   - **Discovery**: Need to handle URL-safe base64 encoding

2. **Export Functionality** ✅
   - Added "Export" button to radial menu
   - Implemented URL generation with encoded preset
   - Added clipboard copy functionality
   - Added toast notifications for feedback
   - **Gotcha**: Clipboard API requires secure context (HTTPS)

3. **Import Functionality** ✅
   - Added URL parameter detection on page load
   - Implemented automatic preset loading
   - Added error handling and console feedback
   - **Note**: Toast notifications for import errors to be added

**Current Implementation Status**:
- Presets can be exported via URL
- URLs are automatically loaded on page visit
- Basic error handling in place
- User feedback via toast notifications

#### Remaining Phases
1. **URL Integration**
   - Add URL parameter parsing on app initialization
   - Implement automatic settings application from URL
   - Add error handling for invalid/malformed URLs

2. **Export Functionality**
   - Add "Export" button to radial menu
   - Implement URL generation with encoded preset
   - Add clipboard copy functionality
   - Add user feedback (toast notification)

3. **Import Functionality**
   - Add URL parameter detection on page load
   - Implement automatic preset loading
   - Add error handling and user feedback
   - Add manual import option

4. **UI/UX Implementation**
   - Radial Menu Updates
   - Implement export button with icon
   - Add loading state and feedback

5. **User Feedback**
   - Add toast notifications for successful exports
   - Add error messages for failed operations
   - Implement loading states during preset application

6. **Mobile Optimization**
   - Ensure URL handling works on mobile
   - Optimize for mobile sharing
   - Add mobile-specific user feedback

7. **Testing and Optimization**
   - Implement unit tests for encoding/decoding
   - Test URL parameter handling
   - Test edge cases and error conditions
   - Test on different devices and browsers

8. **Performance Optimization**
   - Optimize binary conversion functions
   - Minimize URL length
   - Optimize preset loading performance

9. **Error Handling**
   - Implement comprehensive error handling
   - Add fallback mechanisms
   - Improve user feedback for errors

10. **Future Enhancements (Potential)**
    - Supabase integration for preset storage
    - User accounts and authentication
    - Preset browsing and search
    - Rating and favoriting system

11. **Advanced Features**
    - Preset collections
    - Preset categories and tags
    - Preset versioning
    - Preset comments and descriptions

12. **Social Features**
    - Social media sharing
    - Embed codes
    - Preset galleries
    - User profiles

### Progress Tracking
- ✅ Basic WebGL implementation
- ✅ Hybrid rendering system
- ✅ Post-processing effects
- ✅ Mobile support
- ✅ User interface
- 🔄 Performance optimizations
- 🔄 Advanced shader effects
- 🔄 Additional features
