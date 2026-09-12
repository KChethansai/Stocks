"use client";
import { motion, useSpring } from "motion/react";
import { useEffect } from "react";
import { useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";
import {
  indicatorFadeGradientStops,
  resolveVerticalFadeSides
} from "../indicator-fade";
import * as React from "react";
function resolveWidth(width) {
  if (typeof width === "number") {
    return width;
  }
  switch (width) {
    case "line":
      return 1;
    case "thin":
      return 2;
    case "medium":
      return 4;
    case "thick":
      return 8;
    default:
      return 1;
  }
}
function TooltipIndicator(props) {
  if (!props.visible) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(TooltipIndicatorInner, { ...props });
}
function TooltipIndicatorInner({
  x,
  visible,
  height,
  width = "line",
  span,
  columnWidth,
  colorEdge = chartCssVars.crosshair,
  colorMid = chartCssVars.crosshair,
  fadeEdges = "both",
  fadeLength = 10,
  animate = true,
  gradientId = "tooltip-indicator-gradient",
  springConfig,
  strokeDasharray
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const pixelWidth = span !== void 0 && columnWidth !== void 0 ? span * columnWidth : resolveWidth(width);
  const rectX = x - pixelWidth / 2;
  const lineX = x;
  const animatedX = useSpring(rectX, effectiveSpring);
  const animatedLineX = useSpring(lineX, effectiveSpring);
  if (animate) {
    animatedX.set(rectX);
    animatedLineX.set(lineX);
  }
  useEffect(() => {
    animatedX.set(rectX);
    animatedLineX.set(lineX);
  }, [animatedLineX, animatedX, lineX, rectX, visible]);
  const indicatorFill = colorMid || colorEdge;
  const fadeSides = resolveVerticalFadeSides(fadeEdges);
  const dashed = Boolean(strokeDasharray);
  if (dashed) {
    const strokeWidth = Math.max(1, pixelWidth);
    return animate ? /* @__PURE__ */ React.createElement(
      motion.line,
      {
        stroke: indicatorFill,
        strokeDasharray,
        strokeWidth,
        x1: animatedLineX,
        x2: animatedLineX,
        y1: 0,
        y2: height
      }
    ) : /* @__PURE__ */ React.createElement(
      "line",
      {
        stroke: indicatorFill,
        strokeDasharray,
        strokeWidth,
        x1: lineX,
        x2: lineX,
        y1: 0,
        y2: height
      }
    );
  }
  if (!fadeSides.any) {
    return animate ? /* @__PURE__ */ React.createElement(
      motion.rect,
      {
        fill: indicatorFill,
        height,
        width: pixelWidth,
        x: animatedX,
        y: 0
      }
    ) : /* @__PURE__ */ React.createElement(
      "rect",
      {
        fill: indicatorFill,
        height,
        width: pixelWidth,
        x: rectX,
        y: 0
      }
    );
  }
  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);
  return /* @__PURE__ */ React.createElement("g", null, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: gradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%" }, fadeStops.map((stop) => /* @__PURE__ */ React.createElement(
    "stop",
    {
      key: stop.offset,
      offset: stop.offset,
      style: { stopColor: indicatorFill, stopOpacity: stop.opacity }
    }
  )))), animate ? /* @__PURE__ */ React.createElement(
    motion.rect,
    {
      fill: `url(#${gradientId})`,
      height,
      width: pixelWidth,
      x: animatedX,
      y: 0
    }
  ) : /* @__PURE__ */ React.createElement(
    "rect",
    {
      fill: `url(#${gradientId})`,
      height,
      width: pixelWidth,
      x: rectX,
      y: 0
    }
  ));
}
TooltipIndicator.displayName = "TooltipIndicator";
var tooltip_indicator_default = TooltipIndicator;
export {
  TooltipIndicator,
  tooltip_indicator_default as default
};
