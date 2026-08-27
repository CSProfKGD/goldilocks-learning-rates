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
const START_EIGEN = { u: 3.8, v: -3.0 };
const STEP_COUNT = 18;
const SURFACE_HEIGHT = 0.72;

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutPop(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return 1 - Math.exp(-6 * value) * Math.cos(2.8 * Math.PI * value);
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
  { at: 0, color: [31, 39, 190] },
  { at: 0.2, color: [42, 78, 211] },
  { at: 0.38, color: [57, 157, 221] },
  { at: 0.54, color: [94, 205, 194] },
  { at: 0.68, color: [191, 221, 79] },
  { at: 0.8, color: [239, 207, 44] },
  { at: 0.91, color: [229, 111, 34] },
  { at: 1, color: [184, 48, 34] },
] as const;

function surfaceColor(tone: number, luminance = 1) {
  const upperIndex = SURFACE_PALETTE.findIndex((stop) => tone <= stop.at);
  if (upperIndex <= 0) {
    const [r, g, b] = SURFACE_PALETTE[0].color;
    return `rgb(${Math.round(r * luminance)} ${Math.round(g * luminance)} ${Math.round(b * luminance)})`;
  }
  const low = SURFACE_PALETTE[upperIndex - 1];
  const high = SURFACE_PALETTE[upperIndex];
  const amount = (tone - low.at) / (high.at - low.at);
  const channels = low.color.map((channel, index) =>
    Math.round(channel + (high.color[index] - channel) * amount),
  );
  const lit = channels.map((channel) =>
    Math.round(clamp(channel * luminance, 0, 255)),
  );
  return `rgb(${lit[0]} ${lit[1]} ${lit[2]})`;
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
  const lossGuideRef = useRef<SVGPathElement>(null);
  const lossPathRef = useRef<SVGPathElement>(null);
  const lossMarkerRef = useRef<SVGCircleElement>(null);
  const animationRef = useRef<number | null>(null);
  const selectedRef = useRef<PresetId>("right");
  const runRef = useRef(0);
  const [selected, setSelected] = useState<PresetId>("right");
  const [playing, setPlaying] = useState(false);
  const [complete, setComplete] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("Ready to descend");

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const play = useCallback(() => {
    runRef.current += 1;
    setResetting(false);
    setComplete(false);
    setPlaying(true);
    setPhaseLabel("Finding a better view");
    setRunKey(runRef.current);
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    setPlaying(false);
    setResetting(true);
    setPhaseLabel("Returning to the opening view");
    setRunKey(runRef.current);
  }, []);

  const choosePreset = (preset: PresetId) => {
    if (playing || complete || resetting) return;
    runRef.current += 1;
    setPlaying(false);
    setResetting(false);
    setSelected(preset);
    setComplete(false);
    setPhaseLabel("Ready to descend");
    setRunKey(runRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const surfaceCanvas = document.createElement("canvas");
    const surfaceContext = surfaceCanvas.getContext("2d");
    if (!surfaceContext) return;
    const meshCanvas = document.createElement("canvas");
    const meshContext = meshCanvas.getContext("2d");
    if (!meshContext) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startTime = performance.now();
    let didComplete = false;
    let didReset = false;
    let lastAnnouncedPhase = "";
    let resizeTimer: number | null = null;
    let drawLatest: ((now: number) => void) | null = null;

    const phaseTimes = reducedMotion
      ? { rotateEnd: 260, contourStart: 50, contourEnd: 240, ballStart: 660, ballEnd: 840, descentStart: 940, descentEnd: 2920 }
      : { rotateEnd: 1800, contourStart: 220, contourEnd: 1680, ballStart: 2550, ballEnd: 2850, descentStart: 3300, descentEnd: 7600 };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    media.addEventListener("change", onMotionChange);

    const applyResize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = rect.width;
      const nextHeight = rect.height;
      const pixelWidth = Math.round(nextWidth * nextDpr);
      const pixelHeight = Math.round(nextHeight * nextDpr);
      const changed =
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight ||
        width !== nextWidth ||
        height !== nextHeight ||
        dpr !== nextDpr;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const surfaceWidth = Math.max(1, pixelWidth);
      const surfaceHeight = Math.max(1, pixelHeight);
      if (
        surfaceCanvas.width !== surfaceWidth ||
        surfaceCanvas.height !== surfaceHeight
      ) {
        surfaceCanvas.width = surfaceWidth;
        surfaceCanvas.height = surfaceHeight;
      }
      if (
        meshCanvas.width !== surfaceWidth ||
        meshCanvas.height !== surfaceHeight
      ) {
        meshCanvas.width = surfaceWidth;
        meshCanvas.height = surfaceHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      surfaceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      meshContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (changed && drawLatest) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        drawLatest(performance.now());
      }
    };

    const resize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        applyResize();
      }, 110);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    applyResize();

    const preset = PRESETS[selectedRef.current];
    const path = makePath(preset.rate);
    const accent = hexToRgb(preset.color);
    const lossValues = path.map((point) => loss(point.x, point.y));
    const maxLoss = Math.max(...lossValues, 0.001);
    const chartPoint = (index: number, value = lossValues[index]) => ({
      x: 8 + (index / (lossValues.length - 1)) * 164,
      y: 7 + (1 - value / maxLoss) * 52,
    });
    const fullLossPath = lossValues
      .map((value, index) => {
        const point = chartPoint(index, value);
        return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      })
      .join(" ");
    lossGuideRef.current?.setAttribute("d", fullLossPath);

    const draw = (now: number) => {
      const elapsed = playing || resetting ? now - startTime : -1;
      const resetDuration = reducedMotion ? 320 : 1800;
      const resetProgress = resetting
        ? easeInOutCubic(clamp(elapsed / resetDuration))
        : 0;
      const cameraProgress = resetting
        ? 1 - resetProgress
        : playing
          ? easeInOutCubic(clamp(elapsed / phaseTimes.rotateEnd))
          : 0;
      const contourAlpha = resetting
        ? 1 - resetProgress
        : playing
          ? easeInOutCubic(
            clamp(
              (elapsed - phaseTimes.contourStart) /
                (phaseTimes.contourEnd - phaseTimes.contourStart),
            ),
          )
          : 0;
      const ballProgress = resetting
        ? 1
        : playing
          ? clamp(
            (elapsed - phaseTimes.ballStart) /
              (phaseTimes.ballEnd - phaseTimes.ballStart),
          )
          : 0;
      const ballOpacity = resetting ? 1 - resetProgress : 1;
      const descentProgress = resetting
        ? 1
        : playing
          ? easeInOutCubic(
            clamp(
              (elapsed - phaseTimes.descentStart) /
                (phaseTimes.descentEnd - phaseTimes.descentStart),
            ),
          )
          : 0;
      const chartProgress = resetting ? 1 - resetProgress : descentProgress;
      const chartFloat = chartProgress * (lossValues.length - 1);
      const chartIndex = Math.min(Math.floor(chartFloat), lossValues.length - 2);
      const chartAmount = chartFloat - chartIndex;
      const chartParts: string[] = [];
      for (let index = 0; index <= chartIndex; index += 1) {
        const point = chartPoint(index);
        chartParts.push(`${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
      }
      if (chartProgress > 0) {
        const interpolatedLoss =
          lossValues[chartIndex] +
          (lossValues[chartIndex + 1] - lossValues[chartIndex]) * chartAmount;
        const marker = chartPoint(chartIndex + chartAmount, interpolatedLoss);
        chartParts.push(`L${marker.x.toFixed(2)} ${marker.y.toFixed(2)}`);
        lossMarkerRef.current?.setAttribute("cx", marker.x.toFixed(2));
        lossMarkerRef.current?.setAttribute("cy", marker.y.toFixed(2));
      }
      lossPathRef.current?.setAttribute("d", chartProgress > 0 ? chartParts.join(" ") : "");
      if (lossMarkerRef.current) {
        lossMarkerRef.current.style.opacity = chartProgress > 0 ? "1" : "0";
      }
      context.clearRect(0, 0, width, height);

      const baseScale = Math.min(width / 10.8, height / 7.8);
      const scale = baseScale * (0.32 + cameraProgress * 0.68);
      const compactDesktopOffset = clamp((1280 - width) / 380);
      const openingOriginX = width * (
        width <= 720 ? 0.5 : 0.54 + compactDesktopOffset * 0.12
      );
      const topOriginX = width <= 720
        ? width * 0.5
        : Math.min(width * 0.6, width - 52 - START_EIGEN.u * baseScale);
      const originX = openingOriginX + (topOriginX - openingOriginX) * cameraProgress;
      const originY = height * (0.6 - cameraProgress * 0.105);
      const pitch = 0.86 * (1 - cameraProgress);
      const yaw = -1.12 + cameraProgress * 0.69;

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

      const surfaceRadius = 3.25 + cameraProgress * cameraProgress * 16.15;
      const visibleHeightRange = 10.5;
      surfaceContext.clearRect(0, 0, width, height);
      const boundarySteps = 180;
      const traceBoundary = (target: CanvasRenderingContext2D) => {
        target.beginPath();
        for (let index = 0; index <= boundarySteps; index += 1) {
          const angle = (index / boundarySteps) * Math.PI * 2;
          const u = (surfaceRadius / Math.sqrt(LAMBDA_U)) * Math.cos(angle);
          const v = (surfaceRadius / Math.sqrt(LAMBDA_V)) * Math.sin(angle);
          const point = eigenToWorld(u, v);
          const projected = project(
            point.x,
            point.y,
            0.5 * surfaceRadius * surfaceRadius * SURFACE_HEIGHT,
          );
          if (index === 0) target.moveTo(projected.x, projected.y);
          else target.lineTo(projected.x, projected.y);
        }
        target.closePath();
      };

      const bandBlend = easeInOutCubic(clamp((cameraProgress - 0.18) / 0.34));
      const meshAlpha = 1 - bandBlend;
      meshContext.clearRect(0, 0, width, height);
      if (meshAlpha > 0) {
        const uSteps = 64;
        const vSteps = 64;
        const cells: Array<{
          points: ReturnType<typeof project>[];
          depth: number;
          gradientStart: ReturnType<typeof project>;
          gradientEnd: ReturnType<typeof project>;
          startColor: string;
          endColor: string;
        }> = [];
        const uExtent = surfaceRadius / Math.sqrt(LAMBDA_U);
        const vExtent = surfaceRadius / Math.sqrt(LAMBDA_V);
        const surfacePoint = (u: number, v: number) => {
          const point = eigenToWorld(u, v);
          return {
            ...project(point.x, point.y, loss(point.x, point.y) * SURFACE_HEIGHT),
            level: loss(point.x, point.y),
          };
        };
        for (let uIndex = 0; uIndex < uSteps; uIndex += 1) {
          const u0 = -uExtent + (uIndex / uSteps) * uExtent * 2;
          const u1 = -uExtent + ((uIndex + 1) / uSteps) * uExtent * 2;
          for (let vIndex = 0; vIndex < vSteps; vIndex += 1) {
            const v0 = -vExtent + (vIndex / vSteps) * vExtent * 2;
            const v1 = -vExtent + ((vIndex + 1) / vSteps) * vExtent * 2;
            const points = [
              surfacePoint(u0, v0),
              surfacePoint(u1, v0),
              surfacePoint(u1, v1),
              surfacePoint(u0, v1),
            ];
            const orderedByHeight = [...points].sort((a, b) => a.level - b.level);
            const gradientStart = orderedByHeight[0];
            const gradientEnd = orderedByHeight[orderedByHeight.length - 1];
            const startTone = Math.pow(
              clamp(gradientStart.level / visibleHeightRange),
              0.72,
            );
            const endTone = Math.pow(
              clamp(gradientEnd.level / visibleHeightRange),
              0.72,
            );
            cells.push({
              points,
              depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
              gradientStart,
              gradientEnd,
              startColor: surfaceColor(startTone),
              endColor: surfaceColor(endTone),
            });
          }
        }
        cells.sort((a, b) => a.depth - b.depth);
        meshContext.save();
        meshContext.lineJoin = "round";
        for (const cell of cells) {
          const cellGradient = meshContext.createLinearGradient(
            cell.gradientStart.x,
            cell.gradientStart.y,
            cell.gradientEnd.x,
            cell.gradientEnd.y,
          );
          cellGradient.addColorStop(0, cell.startColor);
          cellGradient.addColorStop(1, cell.endColor);
          meshContext.beginPath();
          meshContext.moveTo(cell.points[0].x, cell.points[0].y);
          for (let index = 1; index < cell.points.length; index += 1) {
            meshContext.lineTo(cell.points[index].x, cell.points[index].y);
          }
          meshContext.closePath();
          meshContext.fillStyle = cellGradient;
          meshContext.fill();
          meshContext.strokeStyle = cellGradient;
          meshContext.lineWidth = 0.6;
          meshContext.stroke();
        }
        meshContext.restore();

        meshContext.save();
        meshContext.globalCompositeOperation = "source-atop";
        const meshLight = meshContext.createLinearGradient(
          width * 0.34,
          height * 0.16,
          width * 0.82,
          height * 0.68,
        );
        meshLight.addColorStop(0, "rgba(255, 255, 255, 0.085)");
        meshLight.addColorStop(0.5, "rgba(255, 255, 255, 0)");
        meshLight.addColorStop(1, "rgba(0, 0, 0, 0.16)");
        meshContext.fillStyle = meshLight;
        meshContext.fillRect(0, 0, width, height);
        const meshValley = project(0, 0, 0);
        const meshValleyShade = meshContext.createRadialGradient(
          meshValley.x,
          meshValley.y,
          0,
          meshValley.x,
          meshValley.y,
          scale * 3.6,
        );
        meshValleyShade.addColorStop(0, "rgba(0, 0, 0, 0.18)");
        meshValleyShade.addColorStop(1, "rgba(0, 0, 0, 0)");
        meshContext.fillStyle = meshValleyShade;
        meshContext.fillRect(0, 0, width, height);
        meshContext.restore();

        surfaceContext.save();
        surfaceContext.globalAlpha = meshAlpha;
        surfaceContext.filter = "blur(0.55px)";
        surfaceContext.drawImage(meshCanvas, 0, 0, width, height);
        surfaceContext.filter = "none";
        surfaceContext.globalAlpha = meshAlpha * 0.28;
        surfaceContext.drawImage(meshCanvas, 0, 0, width, height);
        surfaceContext.restore();
      }

      surfaceContext.save();
      surfaceContext.globalAlpha = bandBlend;
      traceBoundary(surfaceContext);
      surfaceContext.clip();
      surfaceContext.fillStyle = surfaceColor(1, 0.86);
      surfaceContext.fillRect(0, 0, width, height);
      const colorRadius = Math.min(surfaceRadius, 6.2);
      const colorBandCount = 360;
      const colorBandSteps = 96;
      for (let band = colorBandCount - 1; band >= 0; band -= 1) {
        const radius = colorRadius * ((band + 1) / colorBandCount);
        const level = 0.5 * radius * radius;
        const tone = Math.pow(clamp(level / visibleHeightRange), 0.72);
        const bandPoints: ReturnType<typeof project>[] = [];
        for (let index = 0; index <= colorBandSteps; index += 1) {
          const angle = (index / colorBandSteps) * Math.PI * 2;
          const u = (radius / Math.sqrt(LAMBDA_U)) * Math.cos(angle);
          const v = (radius / Math.sqrt(LAMBDA_V)) * Math.sin(angle);
          const point = eigenToWorld(u, v);
          const projected = project(point.x, point.y, level * SURFACE_HEIGHT);
          bandPoints.push(projected);
        }
        surfaceContext.beginPath();
        surfaceContext.moveTo(bandPoints[0].x, bandPoints[0].y);
        for (let index = 1; index < bandPoints.length; index += 1) {
          surfaceContext.lineTo(bandPoints[index].x, bandPoints[index].y);
        }
        surfaceContext.closePath();
        surfaceContext.fillStyle = surfaceColor(tone);
        surfaceContext.fill();
      }

      const directionalLight = surfaceContext.createLinearGradient(
        width * 0.18,
        height * 0.12,
        width * 0.9,
        height * 0.88,
      );
      directionalLight.addColorStop(0, "rgba(255, 255, 255, 0.075)");
      directionalLight.addColorStop(0.48, "rgba(255, 255, 255, 0)");
      directionalLight.addColorStop(1, "rgba(0, 0, 0, 0.14)");
      surfaceContext.fillStyle = directionalLight;
      surfaceContext.fillRect(0, 0, width, height);

      const projectedValley = project(0, 0, 0);
      const valleyShade = surfaceContext.createRadialGradient(
        projectedValley.x,
        projectedValley.y,
        0,
        projectedValley.x,
        projectedValley.y,
        scale * 3.8,
      );
      valleyShade.addColorStop(0, "rgba(0, 0, 0, 0.2)");
      valleyShade.addColorStop(0.72, "rgba(0, 0, 0, 0.035)");
      valleyShade.addColorStop(1, "rgba(0, 0, 0, 0)");
      surfaceContext.fillStyle = valleyShade;
      surfaceContext.fillRect(0, 0, width, height);

      const edgeGradient = surfaceContext.createRadialGradient(
        originX,
        originY,
        scale * 1.1,
        originX,
        originY,
        scale * 4.9,
      );
      edgeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      edgeGradient.addColorStop(1, `rgba(0, 0, 0, ${0.12 + 0.05 * (1 - cameraProgress)})`);
      surfaceContext.fillStyle = edgeGradient;
      surfaceContext.fillRect(0, 0, width, height);
      traceBoundary(surfaceContext);
      surfaceContext.globalCompositeOperation = "destination-out";
      surfaceContext.strokeStyle = "rgba(0, 0, 0, 1)";
      surfaceContext.lineWidth = 14;
      surfaceContext.lineJoin = "round";
      surfaceContext.lineCap = "round";
      surfaceContext.stroke();
      surfaceContext.globalCompositeOperation = "source-over";
      surfaceContext.restore();

      context.save();
      context.globalAlpha = 0.86;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(surfaceCanvas, 0, 0, width, height);
      context.restore();

      context.save();
      context.globalAlpha = bandBlend;
      traceBoundary(context);
      context.strokeStyle = "rgba(154, 205, 237, 0.12)";
      context.lineWidth = 1;
      context.stroke();
      context.restore();

      context.save();
      traceBoundary(context);
      context.clip();

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
        context.save();
        context.globalAlpha = ballOpacity;
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
        const pop = easeOutPop(ballProgress);
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
        context.restore();
      }

      context.restore();

      let phase = "Ready to descend";
      if (resetting) {
        phase = "Returning to the opening view";
      } else if (playing) {
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

      if (resetting && elapsed >= resetDuration && !didReset) {
        didReset = true;
        setResetting(false);
        setComplete(false);
        setPhaseLabel("Ready to descend");
      }

      animationRef.current = playing || resetting ? requestAnimationFrame(draw) : null;
    };

    drawLatest = draw;
    draw(performance.now());

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMotionChange);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [runKey, selected, resetting]);

  return (
    <main className="experience">
      <section className="hero" aria-labelledby="page-title">
        <div className="intro">
          <p className="kicker">Gradient descent</p>
          <h1 id="page-title">The Goldilocks<br />Principle<br />of Learning Rates</h1>
          <p className="lede">One number. Three very different outcomes.</p>
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

      <aside
        className="loss-chart"
        aria-label={`Loss versus iteration for the ${PRESETS[selected].label.toLowerCase()} learning rate`}
        style={{ color: PRESETS[selected].color }}
      >
        <p className="loss-chart-heading">Loss <span>vs iteration</span></p>
        <svg viewBox="0 0 180 70" role="img" aria-hidden="true">
          <path className="loss-chart-axis" d="M8 7 V59 H172" />
          <path ref={lossGuideRef} className="loss-chart-guide" />
          <path ref={lossPathRef} className="loss-chart-path" />
          <circle ref={lossMarkerRef} className="loss-chart-marker" r="2.5" />
          <text className="loss-chart-y-label" x="5" y="8">LOSS</text>
          <text className="loss-chart-x-label" x="172" y="68">ITERATION</text>
        </svg>
      </aside>

      <section className="control-dock" aria-label="Animation controls">
        <div className="preset-group" role="radiogroup" aria-label="Choose a learning rate">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected === id}
              className={`preset preset-${id} ${selected === id ? "selected" : ""}`}
              disabled={playing || complete || resetting}
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
        <button
          type="button"
          className="play-button"
          onClick={complete ? reset : play}
          disabled={playing || resetting}
          aria-label={complete ? "Reset animation" : "Play animation"}
        >
          <span className={complete ? "reset-icon" : "play-icon"} aria-hidden="true">
            {complete ? "↻" : ""}
          </span>
          <span>{resetting ? "Resetting" : playing ? "Playing" : complete ? "Reset" : "Play"}</span>
        </button>
      </section>
    </main>
  );
}
