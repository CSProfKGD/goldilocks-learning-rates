# Learning Rate Animation — Product Context

## Purpose

Create an interactive visual explanation of gradient descent that makes three learning-rate behaviors immediately understandable:

- **Too low:** correct direction, but frustratingly slow progress.
- **Too large:** repeated overshooting, oscillation, and possible divergence.
- **Just right:** fast, controlled convergence to the minimum.

The experience should feel like a short, premium presentation rather than a simulation dashboard. The reference quality bar is an Apple Keynote animation: elegant staging, precise timing, smooth camera work, and minimal interface chrome.

Final working title: **The Goldilocks Principle of Learning Rates**.

The eyebrow, title, and subtitle are treated as one upper-left presentation block. Its top edge sits at roughly 7% of the desktop viewport, preserving the established left margin while leaving the lower-left intentionally open.

## Source-project status

The requested starting point was the **Gradient Descent** project, but its source was not available in the workspace. The current implementation was therefore built as a deterministic canvas presentation rather than inventing compatibility with an unseen codebase. It retains the requested single-ball, actual-position trail behavior.

## Core scene

- One smooth 3D parabola/bowl surface representing the loss landscape. It extends beyond the scene so the browser viewport—not an artificial oval or rectangular model boundary—is the visible clipping boundary.
- The experience uses a pure black background with no top header, logo strip, status strip, or header divider.
- The surface uses a height-normalized cool gradient: midnight indigo in the valley, royal blue through the lower slopes, restrained cyan/teal at upper-middle elevations, and lavender-blue at the highest peaks. Smooth filled elevation bands are generated from the same analytical loss ellipses and projected surface heights as the contours, then clipped through a high-resolution analytical silhouette. A restrained upper-left luminance gradient adds directional depth without facets. The offscreen surface buffer renders at the full device-pixel ratio and composites without blur, preserving a crisp silhouette and smooth interior color through the full camera move.
- One ball representing the current parameter state.
- One trail outlining that ball's past positions, matching the treatment used in the source Gradient Descent project.
- No isocurve plane.
- No extra balls or side-by-side simulations.
- A small set of subtle contour/isocurve lines dissolves directly onto the surface as one coordinated field while the camera rotates and zooms. Every contour shares the same opacity curve; none are delayed or individually staggered. The curves use the same loss function as the bowl and naturally clip at the browser viewport.
- The opening camera shows the full bowl centered and deliberately zoomed out. The move to the top view combines rotation and zoom using the same slow-in/slow-out easing curve.
- All three presets use the same surface and the same initial ball position so the motion is directly comparable.

## Interface

The bottom control area contains three mutually exclusive learning-rate choices:

1. `Too low`
2. `Too large`
3. `Just right`

Each option includes its numeric learning rate. It also provides a clear play control that becomes `Reset` after a run; Reset returns to the ready frame and waits for a new Play. The selected option is unmistakable but visually quiet, using semantic color and type rather than a boxed selection. Controls live in a tightly fitted translucent glass panel with minimal unused space and remain anchored and stable while the scene animates.

Initial default: **Just right**.

## Storyboard

The exact timings should be tuned by eye after implementation. The following is the intended sequence and a useful first timing pass.

| Phase | Approx. time | Visual action |
| --- | ---: | --- |
| Ready | Before play | Show the empty 3D parabola from an elegant three-quarter perspective. Bottom controls are visible. Contours and ball are hidden. |
| Camera move | 0.0–1.8 s | On play, smoothly rotate and zoom the centered, distant bowl toward a true or near-true top view. Rotation and zoom ease in and out together; there is no hard cut. |
| Contour reveal | 0.22–1.68 s | During the camera move, the complete restrained contour field dissolves in together with one shared opacity curve. |
| Ball entrance | 2.88–3.28 s | One ball appears at the shared initial point with a refined pop: fade plus small scale/vertical settle. |
| Anticipation | 3.28–3.78 s | Brief pause so the viewer registers the start position and contours. |
| Descent | 3.78 s onward | Run gradient descent using the selected preset. As the ball moves, reveal a trail through its actual past positions. Camera remains stable and the ball's motion is the focus. |
| Resolve | End | Hold the final ball and trail without an outcome label. Play becomes Reset, and all three preset choices are enabled. Choosing a new preset resets to the ready scene and waits for Play. |

The contour reveal may overlap the latter part of the camera move, but it should not begin so early that the opening perspective becomes visually busy.

## Learning-rate behaviors

The deterministic quadratic uses eigenvalue curvatures `0.56` and `0.23`, 18 updates, and one shared start point. The fixed learning rates are `0.065` (Too low), `3.5` (Too large), and `1.2` (Just right).

### Too low

- Moves consistently downhill in small steps.
- Clearly demonstrates that the direction is correct.
- Ends noticeably short of the minimum within the presentation window, or takes conspicuously longer to arrive.
- Should read as inefficient, not broken or frozen.

### Too large

- Overshoots the minimum and crosses the bowl repeatedly.
- Oscillation should be obvious from the top view.
- May expand outward or fail to settle, but the ball must stay within a composed, readable camera frame.
- Should read as unstable, not as random movement or a physics bounce.

### Just right

- Takes confident, progressively smaller steps toward the center.
- Converges quickly without distracting oscillation.
- Finishes at or visually very near the minimum.
- Should provide the most satisfying resolution of the three.

## Motion language

- Camera: smooth, confident, slow-in/slow-out, with no visible snapping at the end.
- Contours: the complete field dissolves in together during rotation and zoom; no per-ring delay or harsh toggle.
- Ball entrance: restrained scale overshoot and settle—a small, polished bounce lasting only a few hundred milliseconds.
- Gradient descent: positions should come from the optimization algorithm. Interpolate between algorithm steps only to make the true sequence readable and fluid.
- Trail: extend it from the ball's sampled position history as descent progresses. Its luminous core, soft halo, and sequential position markers use cyan for Too low, coral for Too large, and green for Just right.
- Ending: gently hold the final ball and trail. Do not add a label, badge, or celebratory effect around the ball.

## Suggested state model

The implementation should be expressible with these conceptual states:

`ready → rotating → revealing-contours → introducing-ball → paused → descending → complete`

Some visual phases may overlap on the timeline even if the logical state has one primary phase. The system should also support `resetting` and a reduced-motion path.

## Accessibility and responsiveness

- Preset options and playback controls must be keyboard accessible and have visible focus states.
- Do not rely on color alone to identify the selected preset or explain an outcome.
- Provide useful accessible labels for the visualization and controls.
- Respect reduced-motion preferences with a short crossfade/reframe and fewer interpolated descent movements.
- Keep controls usable and the bowl legible on smaller screens; adjust framing and spacing rather than shrinking everything indiscriminately.
- During live window resizing, retain and scale the last rendered canvas frame. Resize the backing buffers and redraw atomically after dimensions settle so the surface, contours, ball, and trail never flash blank.

## Resolved implementation choices

- React/Vinext with a high-DPI 2D canvas renderer.
- Deterministic rotated anisotropic quadratic and fixed presets listed above.
- Dark navy-to-indigo surface, subdued contour field, and semantic path colors.
- Near-orthographic top view after an eased 1.8-second rotation-and-zoom move.
- No minimum label; only a small luminous center marker.
- No outcome label appears around the ball after playback.

## Acceptance criteria

- The opening frame shows only the 3D parabola surface and the bottom controls.
- Pressing play triggers one continuous, polished sequence: camera rotates to top view, contours dissolve in, one ball enters, a brief pause occurs, and gradient descent begins.
- The visualization never displays an isocurve plane.
- Each preset produces its intended and visibly distinct behavior from the same start point.
- The ball leaves a readable trail through its actual past positions, consistent with the source project.
- Reset plays a coordinated reverse transition: the camera eases back through its zoom and rotation while the ball, trail, and complete contour field dissolve out together. After the transition, the control returns to Play and playback waits.
- The result feels presentation-grade, not like a raw technical demo.
