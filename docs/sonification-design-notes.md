# Emergent Field Explorer — Sonification Design Notes

## Core principle: material honesty

The visual fields in the explorer are emergent — bowls, bulges, fast lines, blobs — none of these exist in the data. They only exist in the *interaction* between two grids of dots. The code knows about dots; the code does not know about fields.

The sonification must work the same way. We are not going to:

- Analyze pixel data to detect blobs and turn them into sounds
- Map detected emergent entities to MIDI or musical scales
- Pick a point and "listen" through it
- Constrain anything to musical scales (at least not at the start)

We **are** going to build a parallel synthesis engine that operates on the same primitives as the visual layer (the two grids of dots), and let the audio fields emerge from the same kind of interaction that produces the visual fields. Two parallel moires — one for the eyes, one for the ears — driven by the same source.

## The model

Each dot in each grid is associated with an oscillator (or some simple sound primitive — exact synthesis to be determined). Most of the time, every oscillator is silent or near-silent. Sound only happens when a dot in grid A is in proximity to a dot in grid B.

When two dots from opposing grids overlap or come close, that interaction produces an audio event. The amplitude of the event is a function of how close the dots are (and possibly how large they are — dot radius defines interaction range). When the interaction ends, the event fades.

The audio field is the sum of all these little proximity events happening across the grids at any given moment. Like the visual field, it is not designed — it emerges.

Possible synthesis approaches for the interaction itself (to be explored):

- Simple amplitude envelope on a sine per dot
- Ring modulation between the two interacting oscillators
- Cross-fade or gating
- Frequency derived from grid position; amplitude from proximity

Start simple: amplitude modulation as a function of distance. Add timbre complexity later.

## The performance problem

Grids in the explorer are dense. We are looking at thousands of dots per grid — sometimes hundreds in each dimension. A naive approach where every dot in grid A checks distance against every dot in grid B is millions of operations per frame. Not viable.

Two key realizations make this tractable:

**Audio doesn't need to recompute proximity at audio rate.** The visual animation runs at 15 or 30 fps. Dot positions change at that rate. Proximity calculations only need to happen at that rate too. Audio rate processing (envelopes, smoothing, the actual sound generation) sits on top and interpolates between updates. This already drops us from millions of ops per second to tens of thousands.

**We don't need to check every dot against every dot.** Dots that are far apart can't possibly be interacting. We use a spatial hash to skip them entirely.

## Spatial hash

Divide the canvas into a grid of cells — say, a 10×10 cell grid over a 1000×1000 canvas (cell size 100×100 pixels). The cell size should be tuned to be roughly the maximum interaction distance between dots, so that any potential interaction is contained within a cell and its immediate neighbors.

Each frame, when dot positions update:

1. Clear all cells.
1. Loop once through every dot. For each dot, compute which cell it lives in (`cellX = floor(dot.x / cellSize)`, `cellY = floor(dot.y / cellSize)`). Add a reference to the dot into that cell's list.

Now we have a lookup: given a position, we can immediately find the small set of dots that are nearby.

When checking interactions:

1. For each dot in grid A, find its cell.
1. Check only the dots in grid B that live in that cell plus the 8 surrounding cells.
1. For each candidate, compute distance. If within interaction range, generate an audio event.

This drops the per-dot check from "thousands" to "maybe 5 to 20." Total work per frame becomes manageable even with thousands of dots.

## Update flow per frame

1. Visual layer updates dot positions (15 or 30 fps).
1. Rebuild spatial hash for grid B (and grid A if it's also moving).
1. For each dot in grid A, query the hash and find nearby dots in grid B.
1. For each pair within interaction range, compute a target amplitude based on distance (closer = louder; falls off to zero at the edge of the interaction radius).
1. Send these target amplitudes to the audio engine.
1. The audio engine smooths between target values at audio rate so we don't get clicks or steppy artifacts.

## Open questions for implementation

- What is the synthesis primitive per dot? Sine? Something noisier? Something with character?
- Is frequency a function of grid position, or is it fixed per grid, or something else entirely?
- How does the dot radius from the visual layer map to interaction radius in the audio domain? Same value? Scaled?
- Does the blur/threshold ("blob") effect have any audio analog, or do we leave it out of the first pass? (Initial answer: leave it out. Get the basic interaction working first.)
- When two dots interact, do *both* oscillators get amplified, or does the interaction itself produce a third sound (like ring modulation output)?
- How many simultaneous interactions can the audio engine handle gracefully? Do we need to cap voices?

## What to build first

A minimum viable version:

1. Two grids of dots (reuse the existing visual layer's data).
1. Web Audio API: a pool of oscillators, one per dot, all at fixed frequencies derived from grid position (e.g., x position maps to frequency), all started at zero gain.
1. Spatial hash rebuilt each animation frame.
1. Per frame, compute proximity-based target gains and send them to each oscillator's gain node with a short ramp time (e.g., 30–50 ms) to smooth between frames.
1. Listen. See what it sounds like. Iterate from there.

Once that's working and the basic principle is proven, we can experiment with timbres, interaction models, and whether the blob effect has a meaningful audio counterpart.
