"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PresetId = "low" | "high" | "right";
type Point = { x: number; y: number };

const PRESETS: Record<
  PresetId,
  { label: string; eyebrow: string; rate: number; summary: string; color: string }
> = {
  low: {
    label: "Too low",
    eyebrow: "Cautious",
    rate: 0.065,
    summary: "Slow progress",
    color: "#69d5e7",
  },
  high: {
    label: "Too large",
    eyebrow: "Unstable",
    rate: 3.5,
    summary: "Unstable",
    color: "#ff8a65",
  },
  right: {
    label: "Just right",
    eyebrow: "Balanced",
    rate: 1.2,
    summary: "Converges",
    color: "#70d98b",
  },
};

const LAMBDA_U = 0.56;
const LAMBDA_V = 0.23;
const ROTATION = 0.43;
const START_EIGEN = { u: -3.8, v: 3.0 };
const STEP_COUNT = 18;
const SURFACE_HEIGHT = 0.72;

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

const SURFACE_PALETTE = [
  { at: 0, color: [5, 14, 34] },
  { at: 0.24, color: [8, 35, 67] },
  { at: 0.48, color: [18, 64, 88] },
  { at: 0.7, color: [41, 52, 91] },
  { at: 0.86, color: [62, 49, 89] },
  { at: 1, color: [91, 65, 68] },
] as const;

function surfaceColor(tone: number) {
  const upperIndex = SURFACE_PALETTE.findIndex((stop) => tone <= stop.at);
  if (upperIndex <= 0) {
    const [r, g, b] = SURFACE_PALETTE[0].color;
    return `rgb(${r} ${g} ${b})`;
  }
  const low = SURFACE_PALETTE[upperIndex - 1];
  const high = SURFACE_PALETTE[upperIndex];
  const amount = (tone - low.at) / (high.at - low.at);
  const channels = low.color.map((channel, index) =>
    Math.round(channel + (high.color[index] - channel) * amount),
  );
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
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

  const reset = useCallback(() => {
    runRef.current += 1;
    setPlaying(false);
    setComplete(false);
    setPhaseLabel("Ready to descend");
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
    const surfaceCanvas = document.createElement("canvas");
    const surfaceContext = surfaceCanvas.getContext("2d");
    if (!surfaceContext) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = performance.now();
    let didComplete = false;
    let lastAnnouncedPhase = "";

    const phaseTimes = reducedMotion
      ? { rotateEnd: 260, contourStart: 50, contourEnd: 240, ballStart: 660, ballEnd: 840, descentStart: 940, descentEnd: 2920 }
      : { rotateEnd: 1800, contourStart: 220, contourEnd: 1680, ballStart: 2550, ballEnd: 2850, descentStart: 3300, descentEnd: 7600 };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    media.addEventListener("change", onMotionChange);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const surfaceWidth = Math.max(1, Math.round(width));
      const surfaceHeight = Math.max(1, Math.round(height));
      if (
        surfaceCanvas.width !== surfaceWidth ||
        surfaceCanvas.height !== surfaceHeight
      ) {
        surfaceCanvas.width = surfaceWidth;
        surfaceCanvas.height = surfaceHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const preset = PRESETS[selectedRef.current];
    const path = makePath(preset.rate);
    const accent = hexToRgb(preset.color);

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
      const landscapeAlpha = !playing
        ? 1
        : elapsed < 260
          ? 1 - easeInOutCubic(clamp(elapsed / 260)) * 0.48
          : 0.52 + easeInOutCubic(clamp((elapsed - 260) / 640)) * 0.48;

      context.clearRect(0, 0, width, height);

      const baseScale = Math.min(width / 10.8, height / 7.8);
      const scale = baseScale * (0.36 + cameraProgress * 0.64);
      const originX = width * (
        width < 900 ? 0.5 : 0.54 + cameraProgress * 0.14
      );
      const originY = height * (0.56 - cameraProgress * 0.065);
      const pitch = 0.68 * (1 - cameraProgress);
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

      const horizontalSteps = 60;
      const verticalSteps = 50;
      const triangles: {
        points: ReturnType<typeof project>[];
        depth: number;
        tones: [number, number, number];
      }[] = [];

      const xExtent = 5.7 + cameraProgress * 10.3;
      const yFrontExtent = 4.8 + cameraProgress * 9.2;
      const yBackExtent = 4.8 + cameraProgress * 11.2;
      const xMin = -xExtent;
      const xMax = xExtent;
      const yMin = -yFrontExtent;
      const yMax = yBackExtent;
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
      surfaceContext.clearRect(0, 0, width, height);
      for (const triangle of triangles) {
        let lowIndex = 0;
        let highIndex = 0;
        triangle.tones.forEach((tone, index) => {
          if (tone < triangle.tones[lowIndex]) lowIndex = index;
          if (tone > triangle.tones[highIndex]) highIndex = index;
        });
        const lowPoint = triangle.points[lowIndex];
        const highPoint = triangle.points[highIndex];
        const color = surfaceContext.createLinearGradient(
          lowPoint.x,
          lowPoint.y,
          highPoint.x,
          highPoint.y,
        );
        color.addColorStop(0, surfaceColor(triangle.tones[lowIndex]));
        color.addColorStop(1, surfaceColor(triangle.tones[highIndex]));
        surfaceContext.beginPath();
        surfaceContext.moveTo(triangle.points[0].x, triangle.points[0].y);
        surfaceContext.lineTo(triangle.points[1].x, triangle.points[1].y);
        surfaceContext.lineTo(triangle.points[2].x, triangle.points[2].y);
        surfaceContext.closePath();
        surfaceContext.fillStyle = color;
        surfaceContext.fill();
      }

      const edgeGradient = surfaceContext.createRadialGradient(
        originX,
        originY,
        scale * 1.1,
        originX,
        originY,
        scale * 4.9,
      );
      edgeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      edgeGradient.addColorStop(1, `rgba(0, 0, 0, ${0.2 + 0.08 * (1 - cameraProgress)})`);
      surfaceContext.fillStyle = edgeGradient;
      surfaceContext.fillRect(0, 0, width, height);

      context.save();
      context.globalAlpha = landscapeAlpha * 0.86;
      context.filter = "blur(3.2px)";
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(surfaceCanvas, 0, 0, width, height);
      context.restore();

      if (contourAlpha > 0) {
        context.save();
        const rings = [
          0.42, 0.7, 1.02, 1.38, 1.78, 2.22, 2.72, 3.28, 3.92, 4.66, 5.5,
        ];
        rings.forEach((radius, ringIndex) => {
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
          const prominence = 0.25 - ringIndex * 0.009;
          context.strokeStyle = `rgba(205, 229, 245, ${contourAlpha * prominence})`;
          context.lineWidth = ringIndex < 3 ? 1.05 : 0.75;
          context.stroke();
        });
        context.restore();

        const minimum = project(0, 0, 0.045);
        for (const ring of [10, 5.5]) {
          context.beginPath();
          context.arc(minimum.x, minimum.y, ring, 0, Math.PI * 2);
          context.strokeStyle = `rgba(232, 245, 255, ${contourAlpha * (ring === 10 ? 0.08 : 0.16)})`;
          context.lineWidth = 1;
          context.stroke();
        }
        context.beginPath();
        context.arc(minimum.x, minimum.y, 2, 0, Math.PI * 2);
        context.fillStyle = `rgba(246, 251, 255, ${contourAlpha * 0.92})`;
        context.fill();
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
          context.strokeStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.16)`;
          context.lineWidth = 8;
          context.stroke();
          context.strokeStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.96)`;
          context.lineWidth = 2.7;
          context.stroke();
          context.restore();

          for (let index = 0; index <= stepIndex; index += 1) {
            const point = path[index];
            const projected = project(point.x, point.y, loss(point.x, point.y) * SURFACE_HEIGHT + 0.045);
            context.beginPath();
            context.arc(projected.x, projected.y, 3.2, 0, Math.PI * 2);
            context.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.18)`;
            context.fill();
            context.beginPath();
            context.arc(projected.x, projected.y, 1.35, 0, Math.PI * 2);
            context.fillStyle = `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.98)`;
            context.fill();
          }
        }

        const projectedBall = project(ball.x, ball.y, loss(ball.x, ball.y) * SURFACE_HEIGHT + 0.12);
        const pop = easeOutCubic(ballProgress);
        const radius = (5.4 + Math.min(width, height) * 0.0024) * pop;
        const glow = context.createRadialGradient(
          projectedBall.x,
          projectedBall.y,
          radius * 0.25,
          projectedBall.x,
          projectedBall.y,
          radius * 3.2,
        );
        glow.addColorStop(0, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.24)`);
        glow.addColorStop(1, `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(projectedBall.x, projectedBall.y, radius * 3.2, 0, Math.PI * 2);
        context.fill();

        const sphere = context.createRadialGradient(
          projectedBall.x - radius * 0.32,
          projectedBall.y - radius * 0.38,
          radius * 0.08,
          projectedBall.x,
          projectedBall.y,
          radius,
        );
        sphere.addColorStop(0, "rgba(255, 255, 255, 0.96)");
        sphere.addColorStop(0.36, preset.color);
        sphere.addColorStop(1, `rgb(${Math.round(accent.r * 0.52)} ${Math.round(accent.g * 0.52)} ${Math.round(accent.b * 0.52)})`);
        context.beginPath();
        context.arc(projectedBall.x, projectedBall.y, radius, 0, Math.PI * 2);
        context.fillStyle = sphere;
        context.fill();
        context.strokeStyle = "rgba(255, 255, 255, 0.42)";
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

      if (playing && elapsed >= phaseTimes.descentEnd + 1150 && !didComplete) {
        didComplete = true;
        setPlaying(false);
        setComplete(true);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw(performance.now());

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
          <p className="kicker">Gradient descent</p>
          <h1 id="page-title">The Goldilocks<br />Principle<br />of Learning Rates</h1>
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
              className={`preset preset-${id} ${selected === id ? "selected" : ""}`}
              disabled={playing}
              onClick={() => choosePreset(id)}
            >
              <span className="preset-indicator" />
              <span className="preset-copy">
                <strong>{PRESETS[id].label}</strong>
                <small>η {PRESETS[id].rate.toFixed(3)}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="dock-divider" />
        <button
          type="button"
          className="play-button"
          onClick={complete ? reset : play}
          disabled={playing}
          aria-label={complete ? "Reset animation" : "Play animation"}
        >
          <span className={complete ? "reset-icon" : "play-icon"} aria-hidden="true">
            {complete ? "↻" : ""}
          </span>
          <span>{playing ? "Playing" : complete ? "Reset" : "Play"}</span>
        </button>
      </section>
    </main>
  );
}
