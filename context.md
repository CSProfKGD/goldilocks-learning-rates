# Learning Rate Animation — Product Context

## Purpose

Create an interactive visual explanation of gradient descent that makes three learning-rate behaviors immediately understandable:

- **Too low:** correct direction, but frustratingly slow progress.
- **Too large:** repeated overshooting, oscillation, and possible divergence.
- **Just right:** fast, controlled convergence to the minimum.

The experience should feel like a short, premium presentation rather than a simulation dashboard. The reference quality bar is an Apple Keynote animation: elegant staging, precise timing, smooth camera work, and minimal interface chrome.

Final working title: **The Goldilocks Principle of Learning Rates**.

## Source-project status

The requested starting point is the **Gradient Descent** project. At the time this file was created, this repository contained no project files, commits, or configured Git remote, and the source project was not available inside the workspace.

Once that source is added, inspect it before locking in the framework, renderer, camera implementation, surface equation, or gradient-descent parameters. Reuse its 3D parabola surface and relevant rendering/math code where sensible.

## Core scene

- One smooth 3D parabola/bowl surface representing the loss landscape. It extends beyond the scene so the browser viewport—not an artificial oval or rectangular model boundary—is the visible clipping boundary.
- The experience uses a pure black background with no top header, logo strip, status strip, or header divider.
- Surface coloring follows loss elevation: deep blue at the minimum, then cyan, green, yellow, orange, and red toward the high edges.
- One ball representing the current parameter state.
- One trail outlining that ball's past positions, matching the treatment used in the source Gradient Descent project.
- No isocurve plane.
- No extra balls or side-by-side simulations.
- Contour/isocurve lines dissolve directly into view as the camera reaches the top view. They span the full visible surface, are computed from the same loss function and height mapping as the bowl, and naturally clip at the browser viewport.
- All three presets use the same surface and the same initial ball position so the motion is directly comparable.

## Interface

The bottom control area contains three mutually exclusive learning-rate choices:

1. `Too low`
2. `Too large`
3. `Just right`

It also provides a clear play control that becomes replay after a run. The selected option should be unmistakable but visually quiet. Controls remain anchored and stable while the scene animates.

Initial default: **Just right**, unless the source project's product context suggests otherwise.

## Storyboard

The exact timings should be tuned by eye after implementation. The following is the intended sequence and a useful first timing pass.

| Phase | Approx. time | Visual action |
| --- | ---: | --- |
| Ready | Before play | Show the empty 3D parabola from an elegant three-quarter perspective. Bottom controls are visible. Contours and ball are hidden. |
| Camera move | 0.0–1.9 s | On play, smoothly rotate and slightly reframe the surface toward a true or near-true top view. No hard cut. |
| Contour reveal | 0.9–2.8 s | As the camera approaches the top view, contour/isocurve lines dissolve in as a radial cascade, beginning at the minimum and progressing slowly outward through successive loss levels. |
| Ball entrance | 2.88–3.28 s | One ball appears at the shared initial point with a refined pop: fade plus small scale/vertical settle. |
| Anticipation | 3.28–3.78 s | Brief pause so the viewer registers the start position and contours. |
| Descent | 3.78 s onward | Run gradient descent using the selected preset. As the ball moves, reveal a trail through its actual past positions. Camera remains stable and the ball's motion is the focus. |
| Resolve | End | Hold the final state long enough to read the outcome. Play becomes replay; preset choices remain available. |

The contour reveal may overlap the latter part of the camera move, but it should not begin so early that the opening perspective becomes visually busy.

## Learning-rate behaviors

Preset numeric values must be derived from the actual surface scale and gradient implementation after the source project is available. Their qualitative behavior is the requirement.

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
- Contours: staggered or softly progressive dissolve; no harsh simultaneous toggle.
- Ball entrance: restrained overshoot and settle, lasting only a few hundred milliseconds.
- Gradient descent: positions should come from the optimization algorithm. Interpolate between algorithm steps only to make the true sequence readable and fluid.
- Trail: extend it from the ball's sampled position history as descent progresses. It uses a high-contrast dark halo, bright core, and visible sampled-position markers so it remains legible across the full blue-to-red surface.
- Ending: gentle hold, with an optional subtle emphasis of the outcome. Avoid celebratory effects.

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

## Decisions intentionally deferred

These should be resolved after inspecting the source project and making a first visual prototype:

- Framework and rendering library.
- Exact parabola equation and scale.
- Exact learning-rate values, iteration counts, and playback duration.
- Exact trail material, thickness, persistence, and fade behavior; begin by matching the source Gradient Descent project.
- Final typography, lighting, and surface material details within the established black-background and blue-to-red elevation palette.
- Whether minimal labels or one-line outcome copy appear after playback.
- Whether top view is perfectly orthographic or retains a slight perspective for depth.

## Acceptance criteria

- The opening frame shows only the 3D parabola surface and the bottom controls.
- Pressing play triggers one continuous, polished sequence: camera rotates to top view, contours dissolve in, one ball enters, a brief pause occurs, and gradient descent begins.
- The visualization never displays an isocurve plane.
- Each preset produces its intended and visibly distinct behavior from the same start point.
- The ball leaves a readable trail through its actual past positions, consistent with the source project.
- Replay fully resets scene, camera, contours, ball, and simulation state.
- The result feels presentation-grade, not like a raw technical demo.
