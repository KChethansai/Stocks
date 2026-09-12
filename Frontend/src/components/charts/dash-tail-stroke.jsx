"use client";
import { useId } from "react";
import * as React from "react";
function DashTailStroke({
  pathD,
  pathLength,
  dashStartLength,
  dashStartX,
  innerWidth,
  innerHeight,
  stroke,
  strokeWidth,
  dashArray
}) {
  const clipPathId = useId().replace(/:/g, "");
  if (!pathD || pathLength <= 0 || dashStartLength >= pathLength) {
    return null;
  }
  const pad = strokeWidth * 2;
  const tailWidth = Math.max(0, innerWidth - dashStartX + pad);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("clipPath", { id: clipPathId }, /* @__PURE__ */ React.createElement(
    "rect",
    {
      height: innerHeight + pad,
      width: tailWidth,
      x: dashStartX - strokeWidth,
      y: -strokeWidth
    }
  ))), /* @__PURE__ */ React.createElement(
    "path",
    {
      d: pathD,
      fill: "none",
      stroke,
      strokeDasharray: `${dashStartLength} ${Math.max(1, pathLength - dashStartLength)}`,
      strokeLinecap: "round",
      strokeWidth
    }
  ), /* @__PURE__ */ React.createElement(
    "path",
    {
      clipPath: `url(#${clipPathId})`,
      d: pathD,
      fill: "none",
      stroke,
      strokeDasharray: dashArray,
      strokeLinecap: "round",
      strokeWidth
    }
  ));
}
export {
  DashTailStroke
};
