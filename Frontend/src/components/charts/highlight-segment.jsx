"use client";
import { motion } from "motion/react";
import { useId } from "react";
import * as React from "react";
function HighlightSegment({
  pathRef,
  visible,
  stroke,
  strokeWidth,
  height,
  x,
  width
}) {
  const clipId = useId();
  if (!(visible && pathRef.current)) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("clipPath", { id: clipId }, /* @__PURE__ */ React.createElement(motion.rect, { height, width, x, y: 0 }))), /* @__PURE__ */ React.createElement(
    motion.path,
    {
      animate: { opacity: 1 },
      clipPath: `url(#${clipId})`,
      d: pathRef.current.getAttribute("d") || "",
      exit: { opacity: 0 },
      fill: "none",
      initial: { opacity: 0 },
      stroke,
      strokeLinecap: "round",
      strokeWidth,
      transition: { duration: 0.4, ease: "easeInOut" }
    }
  ));
}
HighlightSegment.displayName = "HighlightSegment";
var highlight_segment_default = HighlightSegment;
export {
  HighlightSegment,
  highlight_segment_default as default
};
