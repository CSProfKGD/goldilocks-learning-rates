# AGENTS.md

## Project mission

Build a polished, interactive animation that explains how the learning rate changes gradient descent. The experience compares three presets: **Too low**, **Too large**, and **Just right**.

The visual and motion-design bar is Apple Keynote quality: calm, legible, cinematic, and intentional. Prefer a small number of beautifully coordinated elements over a dense scientific visualization.

Read `context.md` before making product, animation, or visual-design decisions.

## Starting point

- Reuse the existing **Gradient Descent** project when its source becomes available.
- Preserve useful surface rendering, camera, lighting, and gradient-descent math from that project.
- This repository was empty when these instructions were created. Do not invent compatibility with an unseen codebase; inspect the imported source before choosing an implementation approach.
- Do not show the isocurve plane used by the source project. The experience uses only the 3D parabola surface, with contour/isocurve lines appearing on the surface in the top view.
- Render one optimization ball only, with a trail that outlines its past positions in the same manner as the source Gradient Descent project.

## Product requirements

- Keep three learning-rate options fixed along the bottom: `Too low`, `Too large`, and `Just right`.
- Include an obvious play/replay control.
- A selection determines the learning rate used on the next playthrough.
- On play, run the storyboard documented in `context.md`.
- The three modes must be visibly distinct while sharing the same starting point, objective surface, camera sequence, and overall duration where practical.
- The result should teach by motion first. Keep explanatory copy concise and secondary.

## Interaction and animation principles

- Treat the animation as a deterministic timeline with named phases, not a loose collection of timeouts.
- Keep camera motion, contour reveal, ball entrance, and optimization motion independently controllable.
- Use smooth easing for presentation motion. Use the actual gradient-descent update rule for the ball's optimization path; do not replace it with a decorative spline.
- Preserve the source project's trail behavior and visual treatment where possible. The trail must be derived from the ball's actual position history.
- Avoid abrupt cuts. Use coordinated transitions, opacity, scale, lighting, and subtle depth cues.
- Respect `prefers-reduced-motion` with a simplified, shorter sequence that preserves the explanation.
- Playback must be replayable and must reset cleanly when the selected learning-rate preset changes.
- Disable or deliberately handle conflicting controls while the timeline is running.

## Visual direction

- Use a pure black background, generous negative space, high-quality typography, soft lighting, and subtle shadows/glow. Color the loss surface by elevation from deep blue at the minimum through cyan, green, yellow, and orange to red at the high edges.
- Keep the objective surface readable from both the opening perspective and the top view.
- Contour lines should dissolve in progressively across the full surface, remain visually subordinate to the ball, and be computed from the same loss function and surface-height mapping.
- The ball should have a clear focal treatment and a small, tasteful entrance pop; avoid cartoonish bounce.
- Maintain stable layout and crisp rendering on high-DPI displays.
- Avoid UI clutter, debug panels, axes, dense tick labels, and technical overlays unless they materially improve comprehension.

## Engineering expectations

- First inspect the imported project's package scripts, framework conventions, and existing rendering architecture.
- Prefer extending existing dependencies over introducing a second rendering or animation stack.
- Separate gradient-descent simulation state from presentation/timeline state.
- Centralize preset values and timeline timings in named configuration rather than scattering magic numbers.
- Keep the simulation deterministic by fixing the initial point and any randomness.
- Make viewport resizing safe, including during playback.
- Preserve unrelated user changes and follow any more-specific `AGENTS.md` found in subdirectories.

## Verification

Before handing off implementation work:

1. Run the repository's existing checks and build.
2. Exercise all three presets from a clean reset.
3. Verify replay, switching presets, resize behavior, and reduced-motion behavior.
4. Confirm there is only one ball, its past-position trail is visible during descent, and there is no isocurve plane.
5. Visually inspect the opening perspective, top-view transition, contour dissolve, ball entrance, and final state at desktop and mobile sizes.
6. Check the browser console for runtime warnings and rendering errors.

## Documentation upkeep

Update `context.md` when product decisions, timings, preset values, or source-project constraints change. Record meaningful assumptions explicitly rather than allowing them to live only in code.
