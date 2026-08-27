"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PresetId = "low" | "high" | "right";
type Point = { x: number; y: number };

const PRESETS: Record<
  PresetId,
  { label: string; eyebrow: string; rate: number; summary: string }
> = {
  low: {
    label: "Too low",
    eyebrow: "Cautious",
    rate: 0.065,
    summary: "Steady, but painfully slow",
  },
  high: {
    label: "Too large",
    eyebrow: "Unstable",
    rate: 3.5,
    summary: "Overshoots again and again",
  },
  right: {
    label: "Just right",
    eyebrow: "Balanced",
    rate: 1.2,
    summary: "Fast, controlled convergence",
  },
};

const LAMBDA_U = 0.56;
const LAMBDA_V = 0.23;
const ROTATION = 0.43;
const START_EIGEN = { u: -2.82, v: 2.18 };
const STEP_COUNT = 18;
const SURFACE_HEIGHT = 0.72;

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutBack(value: number) {
  const c1 = 1.18;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function eigenToWorld(u: number, v: number): Point {
  const cos = Math.cos(ROTATION);
  const sin = Math.sin(ROTATION);
  return { x: u * cos - v * sin, y: u * sin + v * cos };
}

function worldToEigen(x: number, y: number) {
  const cos = Math.cos(ROTATION);
  const sin = Math.sin(ROTATION);
  return { u: x * cos + y * sin, v: -x * sin + y * cos };
}

function loss(x: number, y: number) {
  const { u, v } = worldToEigen(x, y);
  return 0.5 * (LAMBDA_U * u * u + LAMBDA_V * v * v);
}

function makePath(rate: number): Point[] {
  let { u, v } = START_EIGEN;
  const points: Point[] = [];
  for (let index = 0; index <= STEP_COUNT; index += 1) {
    points.push(eigenToWorld(u, v));
    u -= rate * LAMBDA_U * u;
    v -= rate * LAMBDA_V * v;
  }
  return points;
}

function lerpPoint(a: Point, b: Point, amount: number): Point {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
  };
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const selectedRef = useRef<PresetId>("right");
  const runRef = useRef(0);
  const [selected, setSelected] = useState<PresetId>("right");
  const [playing, setPlaying] = useState(false);
  const [complete, setComplete] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("Ready to descend");

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const play = useCallback(() => {
    runRef.current += 1;
    setComplete(false);
    setPlaying(true);
    setPhaseLabel("Finding a better view");
    setRunKey(runRef.current);
  }, []);

  const choosePreset = (preset: PresetId) => {
    if (playing) return;
    setSelected(preset);
    setComplete(false);
    setPhaseLabel("Ready to descend");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = performance.now();
    let didComplete = false;
    let lastAnnouncedPhase = "";

    const phaseTimes = reducedMotion
      ? { rotateEnd: 300, contourStart: 100, contourEnd: 540, ballStart: 570, ballEnd: 760, descentStart: 850, descentEnd: 2990 }
      : { rotateEnd: 1900, contourStart: 900, contourEnd: 2800, ballStart: 2880, ballEnd: 3280, descentStart: 3780, descentEnd: 8580 };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    media.addEventListener("change", onMotionChange);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const preset = PRESETS[selectedRef.current];
    const path = makePath(preset.rate);

    const draw = (now: number) => {
      const elapsed = playing ? now - startTime : -1;
      const cameraProgress = playing
        ? easeInOutCubic(clamp(elapsed / phaseTimes.rotateEnd))
        : 0;
      const contourAlpha = playing
        ? easeInOutCubic(
            clamp(
              (elapsed - phaseTimes.contourStart) /
                (phaseTimes.contourEnd - phaseTimes.contourStart),
            ),
          )
        : 0;
      const ballProgress = playing
        ? clamp(
            (elapsed - phaseTimes.ballStart) /
              (phaseTimes.ballEnd - phaseTimes.ballStart),
          )
        : 0;
      const descentProgress = playing
        ? easeInOutCubic(
            clamp(
              (elapsed - phaseTimes.descentStart) /
                (phaseTimes.descentEnd - phaseTimes.descentStart),
            ),
          )
        : 0;

      context.clearRect(0, 0, width, height);

      const baseScale = Math.min(width / 10.8, height / 7.8);
      const scale = baseScale * (0.67 + cameraProgress * 0.33);
      const originX = width * (width < 900 ? 0.5 : 0.67);
      const originY = height * (0.49 + cameraProgress * 0.005);
      const pitch = 0.82 * (1 - cameraProgress);
      const yaw = -0.62 + cameraProgress * 0.19;

      const project = (x: number, y: number, z: number) => {
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);
        const rx = x * cosYaw - y * sinYaw;
        const ry = x * sinYaw + y * cosYaw;
        const screenY = ry * Math.cos(pitch) - z * 1.45 * Math.sin(pitch);
        const depth = ry * Math.sin(pitch) + z * Math.cos(pitch);
        return {
          x: originX + rx * scale,
          y: originY + screenY * scale,
          depth,
        };
      };

      const horizontalSteps = 52;
      const verticalSteps = 42;
      const triangles: {
        points: ReturnType<typeof project>[];
        depth: number;
        tones: [number, number, number];
      }[] = [];

      const xMin = -14;
      const xMax = 14;
      const yMin = -10;
      const yMax = 10;
      for (let row = 0; row < verticalSteps; row += 1) {
        const y1 = yMin + (row / verticalSteps) * (yMax - yMin);
        const y2 = yMin + ((row + 1) / verticalSteps) * (yMax - yMin);
        for (let column = 0; column < horizontalSteps; column += 1) {
          const x1 = xMin + (column / horizontalSteps) * (xMax - xMin);
          const x2 = xMin + ((column + 1) / horizontalSteps) * (xMax - xMin);
          const worldPoint = (x: number, y: number) => {
            const level = loss(x, y);
            return {
              projected: project(x, y, level * SURFACE_HEIGHT),
              level,
            };
          };
          const p1 = worldPoint(x1, y1);
          const p2 = worldPoint(x2, y1);
          const p3 = worldPoint(x2, y2);
          const p4 = worldPoint(x1, y2);
          triangles.push({
            points: [p1.projected, p2.projected, p3.projected],
            depth: (p1.projected.depth + p2.projected.depth + p3.projected.depth) / 3,
            tones: [clamp(p1.level / 16), clamp(p2.level / 16), clamp(p3.level / 16)],
          });
          triangles.push({
            points: [p1.projected, p3.projected, p4.projected],
            depth: (p1.projected.depth + p3.projected.depth + p4.projected.depth) / 3,
            tones: [clamp(p1.level / 16), clamp(p3.level / 16), clamp(p4.level / 16)],
          });
        }
      }

      triangles.sort((a, b) => a.depth - b.depth);
      for (const triangle of triangles) {
        const surfaceColor = (tone: number) => {
          const colorPosition = Math.pow(tone, 0.68);
          const hue = 238 - colorPosition * 232;
          const lightness = 40 + Math.sin(colorPosition * Math.PI) * 15;
          return `hsl(${hue} 78% ${lightness}%)`;
        };
        let lowIndex = 0;
        let highIndex = 0;
        triangle.tones.forEach((tone, index) => {
          if (tone < triangle.tones[lowIndex]) lowIndex = index;
          if (tone > triangle.tones[highIndex]) highIndex = index;
        });
        const lowPoint = triangle.points[lowIndex];
        const highPoint = triangle.points[highIndex];
        const color = context.createLinearGradient(
          lowPoint.x,
          lowPoint.y,
          highPoint.x,
          highPoint.y,
        );
        color.addColorStop(0, surfaceColor(triangle.tones[lowIndex]));
        color.addColorStop(1, surfaceColor(triangle.tones[highIndex]));
        context.beginPath();
        context.moveTo(triangle.points[0].x, triangle.points[0].y);
        context.lineTo(triangle.points[1].x, triangle.points[1].y);
        context.lineTo(triangle.points[2].x, triangle.points[2].y);
        context.closePath();
        context.fillStyle = color;
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 1.2;
        context.stroke();
      }

      const edgeGradient = context.createRadialGradient(
        originX,
        originY,
        scale * 1.1,
        originX,
        originY,
        scale * 4.9,
      );
      edgeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      edgeGradient.addColorStop(1, `rgba(0, 0, 0, ${0.1 + 0.06 * (1 - cameraProgress)})`);
      context.fillStyle = edgeGradient;
      context.fillRect(0, 0, width, height);

      if (contourAlpha > 0) {
        context.save();
        const rings = [
          0.34, 0.56, 0.79, 1.03, 1.28, 1.53, 1.78, 2.04, 2.3, 2.56,
          2.82, 3.08, 3.34, 3.62, 3.9, 4.2, 4.52, 4.86, 5.22, 5.6, 6,
        ];
        rings.forEach((radius, ringIndex) => {
          const revealStart = (ringIndex / rings.length) * 0.72;
          const stagger = easeInOutCubic(
            clamp((contourAlpha - revealStart) / 0.28),
          );
          if (stagger <= 0) return;
          context.beginPath();
          for (let index = 0; index <= 100; index += 1) {
            const angle = (index / 100) * Math.PI * 2;
            const u = (radius / Math.sqrt(LAMBDA_U)) * Math.cos(angle);
            const v = (radius / Math.sqrt(LAMBDA_V)) * Math.sin(angle);
            const point = eigenToWorld(u, v);
            const projected = project(point.x, point.y, loss(point.x, point.y) * SURFACE_HEIGHT + 0.018);
            if (index === 0) context.moveTo(projected.x, projected.y);
            else context.lineTo(projected.x, projected.y);
          }
          context.strokeStyle = `rgba(0, 0, 0, ${stagger * 0.48})`;
          context.lineWidth = ringIndex % 2 === 0 ? 3.4 : 2.8;
          context.stroke();
          context.strokeStyle = `rgba(255, 255, 255, ${stagger * 0.72})`;
          context.lineWidth = ringIndex % 2 === 0 ? 1.35 : 0.95;
          context.stroke();
        });
        context.restore();

        const minimum = project(0, 0, 0.045);
        context.beginPath();
        context.arc(minimum.x, minimum.y, 2.3, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 235, 220, ${contourAlpha * 0.84})`;
        context.fill();
        context.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
        context.letterSpacing = "1px";
        context.fillStyle = `rgba(255, 245, 237, ${contourAlpha * 0.56})`;
        context.fillText("MINIMUM", minimum.x + 10, minimum.y + 3.5);
      }

      if (ballProgress > 0) {
        const stepFloat = descentProgress * (path.length - 1);
        const stepIndex = Math.min(Math.floor(stepFloat), path.length - 2);
        const stepAmount = stepFloat - stepIndex;
        const ball = lerpPoint(path[stepIndex], path[stepIndex + 1], stepAmount);

        if (descentProgress > 0) {
          context.save();
          context.lineCap = "round";
          context.lineJoin = "round";
          context.beginPath();
          path.slice(0, stepIndex + 1).forEach((point, index) => {
            const projected = project(point.x, point.y, loss(point.x, point.y) * SURFACE_HEIGHT + 0.04);
            if (index === 0) context.moveTo(projected.x, projected.y);
            else context.lineTo(projected.x, projected.y);
          });
          const projectedBall = project(ball.x, ball.y, loss(ball.x, ball.y) * SURFACE_HEIGHT + 0.04);
          context.lineTo(projectedBall.x, projectedBall.y);
          context.strokeStyle = "rgba(0, 0, 0, 0.68)";
          context.lineWidth = 10;
          context.stroke();
          context.strokeStyle = "rgba(255, 244, 230, 0.98)";
          context.lineWidth = 3.5;
          context.stroke();
          context.strokeStyle = "rgba(255, 141, 91, 0.96)";
          context.lineWidth = 1.45;
          context.stroke();
          context.restore();

          for (let index = 0; index <= stepIndex; index += 1) {
            const point = path[index];
            const projected = project(point.x, point.y, loss(point.x, point.y) * SURFACE_HEIGHT + 0.045);
            context.beginPath();
            context.arc(projected.x, projected.y, 3.15, 0, Math.PI * 2);
            context.fillStyle = "rgba(0, 0, 0, 0.62)";
            context.fill();
            context.beginPath();
            context.arc(projected.x, projected.y, 1.75, 0, Math.PI * 2);
            context.fillStyle = "rgba(255, 248, 239, 0.96)";
            context.fill();
          }
        }

        const projectedBall = project(ball.x, ball.y, loss(ball.x, ball.y) * SURFACE_HEIGHT + 0.12);
        const pop = easeOutBack(ballProgress);
        const radius = (8.8 + Math.min(width, height) * 0.005) * pop;
        const glow = context.createRadialGradient(
          projectedBall.x,
          projectedBall.y,
          radius * 0.25,
          projectedBall.x,
          projectedBall.y,
          radius * 2.6,
        );
        glow.addColorStop(0, "rgba(255, 187, 143, 0.44)");
        glow.addColorStop(1, "rgba(255, 149, 105, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(projectedBall.x, projectedBall.y, radius * 2.6, 0, Math.PI * 2);
        context.fill();

        const sphere = context.createRadialGradient(
          projectedBall.x - radius * 0.32,
          projectedBall.y - radius * 0.38,
          radius * 0.08,
          projectedBall.x,
          projectedBall.y,
          radius,
        );
        sphere.addColorStop(0, "#fff5e9");
        sphere.addColorStop(0.3, "#ffc391");
        sphere.addColorStop(1, "#f16f59");
        context.beginPath();
        context.arc(projectedBall.x, projectedBall.y, radius, 0, Math.PI * 2);
        context.fillStyle = sphere;
        context.fill();
        context.strokeStyle = "rgba(255, 255, 255, 0.58)";
        context.lineWidth = 1;
        context.stroke();
      }

      let phase = "Ready to descend";
      if (playing) {
        if (elapsed < phaseTimes.contourStart) phase = "Finding a better view";
        else if (elapsed < phaseTimes.ballStart) phase = "Revealing the landscape";
        else if (elapsed < phaseTimes.descentStart) phase = "Starting position";
        else if (elapsed < phaseTimes.descentEnd) phase = "Gradient descent in motion";
        else phase = PRESETS[selectedRef.current].summary;
      }
      if (phase !== lastAnnouncedPhase) {
        lastAnnouncedPhase = phase;
        setPhaseLabel(phase);
      }

      if (playing && elapsed >= phaseTimes.descentEnd + 650 && !didComplete) {
        didComplete = true;
        setPlaying(false);
        setComplete(true);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMotionChange);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [runKey, selected]);

  return (
    <main className="experience">
      <section className="hero" aria-labelledby="page-title">
        <div className="intro">
          <p className="kicker">One surface. Three paths.</p>
          <h1 id="page-title">The Goldilocks Principle<br />of Learning Rates</h1>
          <p className="lede">
            See how one small number can turn the same downhill direction into
            patience, precision, or chaos.
          </p>
        </div>

        <div className="visualization">
          <canvas
            ref={canvasRef}
            aria-label={`Animated loss surface showing the ${PRESETS[selected].label.toLowerCase()} learning-rate path.`}
            role="img"
          />
          <div className="rate-readout" aria-hidden="true">
            <span>Learning rate</span>
            <strong>{PRESETS[selected].rate.toFixed(3)}</strong>
          </div>
        </div>
      </section>

      <span className="sr-only" aria-live="polite">{phaseLabel}</span>

      <section className="control-dock" aria-label="Animation controls">
        <div className="preset-group" role="radiogroup" aria-label="Choose a learning rate">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected === id}
              className={`preset ${selected === id ? "selected" : ""}`}
              disabled={playing}
              onClick={() => choosePreset(id)}
            >
              <span className="preset-indicator" />
              <span className="preset-copy">
                <small>{PRESETS[id].eyebrow}</small>
                <strong>{PRESETS[id].label}</strong>
              </span>
            </button>
          ))}
        </div>
        <div className="dock-divider" />
        <button
          type="button"
          className="play-button"
          onClick={play}
          disabled={playing}
          aria-label={complete ? "Replay animation" : "Play animation"}
        >
          <span className={complete ? "replay-icon" : "play-icon"} aria-hidden="true">
            {complete ? "↻" : ""}
          </span>
          <span>{playing ? "Playing" : complete ? "Replay" : "Play"}</span>
        </button>
      </section>

      <p className="hint">Choose a pace, then press play</p>
    </main>
  );
}
