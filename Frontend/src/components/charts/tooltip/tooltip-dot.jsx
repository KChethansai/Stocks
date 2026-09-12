"use client";
import { motion, useSpring, useTransform } from "motion/react";
import { useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";
import * as React from "react";
function ringCornerRadius(halfExtent, cornerRadiusFraction) {
  const side = halfExtent * 2;
  return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}
function AnimatedRingDot({
  x,
  y,
  halfExtent,
  cornerRadiusFraction,
  fill,
  stroke,
  strokeWidth,
  springConfig
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const animatedX = useSpring(x, effectiveSpring);
  const animatedY = useSpring(y, effectiveSpring);
  const side = halfExtent * 2;
  const rx = ringCornerRadius(halfExtent, cornerRadiusFraction);
  const rectX = useTransform(animatedX, (value) => value - halfExtent);
  const rectY = useTransform(animatedY, (value) => value - halfExtent);
  animatedX.set(x);
  animatedY.set(y);
  return /* @__PURE__ */ React.createElement(
    motion.rect,
    {
      fill,
      height: side,
      rx,
      ry: rx,
      stroke,
      strokeWidth,
      width: side,
      x: rectX,
      y: rectY
    }
  );
}
function TooltipDot({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = chartCssVars.background,
  strokeWidth = 2,
  variant = "dot",
  cornerRadiusFraction = 0.25,
  springConfig,
  animate = true
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const animatedX = useSpring(x, effectiveSpring);
  const animatedY = useSpring(y, effectiveSpring);
  const isRing = variant === "ring";
  const fill = isRing ? "transparent" : color;
  const stroke = isRing ? color : strokeColor;
  const effectiveStrokeWidth = isRing ? strokeWidth ?? 1.5 : strokeWidth;
  if (animate && !isRing) {
    animatedX.set(x);
    animatedY.set(y);
  }
  if (!visible) {
    return null;
  }
  if (isRing) {
    if (animate) {
      return /* @__PURE__ */ React.createElement(
        AnimatedRingDot,
        {
          cornerRadiusFraction,
          fill,
          halfExtent: size,
          springConfig,
          stroke,
          strokeWidth: effectiveStrokeWidth,
          x,
          y
        }
      );
    }
    const side = size * 2;
    const rx = ringCornerRadius(size, cornerRadiusFraction);
    return /* @__PURE__ */ React.createElement(
      "rect",
      {
        fill,
        height: side,
        rx,
        ry: rx,
        stroke,
        strokeWidth: effectiveStrokeWidth,
        width: side,
        x: x - size,
        y: y - size
      }
    );
  }
  if (!animate) {
    return /* @__PURE__ */ React.createElement(
      "circle",
      {
        cx: x,
        cy: y,
        fill,
        r: size,
        stroke,
        strokeWidth: effectiveStrokeWidth
      }
    );
  }
  return /* @__PURE__ */ React.createElement(
    motion.circle,
    {
      cx: animatedX,
      cy: animatedY,
      fill,
      r: size,
      stroke,
      strokeWidth: effectiveStrokeWidth
    }
  );
}
TooltipDot.displayName = "TooltipDot";
var tooltip_dot_default = TooltipDot;
export {
  TooltipDot,
  tooltip_dot_default as default
};
