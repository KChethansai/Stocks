"use client";
import { motion } from "motion/react";
import { useEffect, useId, useState } from "react";
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
  const [pathD, setPathD] = useState("");
  // The path `d` can change while visible (live data) without a re-render of
  // this component carrying new props, so observe the attribute directly.
  useEffect(() => {
    const el = pathRef?.current;
    if (!el) {
      setPathD("");
      return;
    }
    setPathD(el.getAttribute("d") || "");
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      setPathD(el.getAttribute("d") || "");
    });
    obs.observe(el, { attributes: true, attributeFilter: ["d"] });
    return () => obs.disconnect();
  }, [pathRef, visible]);
  if (!(visible && pathD)) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("clipPath", { id: clipId }, /* @__PURE__ */ React.createElement(motion.rect, { height, width, x, y: 0 }))), /* @__PURE__ */ React.createElement(
    motion.path,
    {
      animate: { opacity: 1 },
      clipPath: `url(#${clipId})`,
      d: pathD,
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
