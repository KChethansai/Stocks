"use client";
import { motion } from "motion/react";
import { clipRevealTransition } from "./animation";
import * as React from "react";
function ChartRevealClip({
  clipPathId,
  height,
  targetWidth,
  enterTransition,
  revealEpoch,
  padding = 0,
  animating = true,
  mode = "reveal",
  onComplete
}) {
  const transition = clipRevealTransition(enterTransition);
  const paddedWidth = Math.max(0, targetWidth + padding * 2);
  const paddedHeight = height + padding * 2;
  if (!animating) {
    return /* @__PURE__ */ React.createElement("clipPath", { id: clipPathId }, /* @__PURE__ */ React.createElement(
      "rect",
      {
        height: paddedHeight,
        width: paddedWidth,
        x: -padding,
        y: -padding
      }
    ));
  }
  if (mode === "conceal") {
    const rightEdge = -padding + paddedWidth;
    return /* @__PURE__ */ React.createElement("clipPath", { id: clipPathId }, /* @__PURE__ */ React.createElement(
      motion.rect,
      {
        animate: { width: 0, x: rightEdge },
        height: paddedHeight,
        initial: { width: paddedWidth, x: -padding },
        key: `conceal-${revealEpoch}`,
        onAnimationComplete: () => onComplete?.(),
        transition,
        y: -padding
      }
    ));
  }
  return /* @__PURE__ */ React.createElement("clipPath", { id: clipPathId }, /* @__PURE__ */ React.createElement(
    motion.rect,
    {
      animate: { width: paddedWidth },
      height: paddedHeight,
      initial: { width: 0 },
      key: `reveal-${revealEpoch}`,
      transition,
      width: paddedWidth,
      x: -padding,
      y: -padding
    }
  ));
}
export {
  ChartRevealClip
};
