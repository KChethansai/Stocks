import {
  fadeGradientStops,
  resolveFadeSides,
  viewportFadeGradientAttrs
} from "./fade-edges";
import * as React from "react";
function AreaGradientDefs({
  gradientId,
  strokeGradientId,
  edgeMaskId,
  edgeGradientId,
  fill,
  fillOpacity,
  gradientToOpacity,
  gradientSpan = 1,
  resolvedStroke,
  isPatternFill,
  fadeEdges,
  innerWidth,
  innerHeight
}) {
  const sides = resolveFadeSides(fadeEdges);
  const strokeStops = sides.any ? fadeGradientStops(sides) : null;
  const showEdgeMask = sides.any && !isPatternFill;
  const edgeStops = showEdgeMask ? fadeGradientStops(sides) : null;
  const span = Math.min(1, Math.max(0.01, gradientSpan));
  const midOffset = `${span * 100}%`;
  return /* @__PURE__ */ React.createElement("defs", null, isPatternFill ? null : /* @__PURE__ */ React.createElement("linearGradient", { id: gradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%" }, /* @__PURE__ */ React.createElement(
    "stop",
    {
      offset: "0%",
      style: { stopColor: fill, stopOpacity: fillOpacity }
    }
  ), /* @__PURE__ */ React.createElement(
    "stop",
    {
      offset: midOffset,
      style: { stopColor: fill, stopOpacity: gradientToOpacity }
    }
  ), span < 1 ? /* @__PURE__ */ React.createElement(
    "stop",
    {
      offset: "100%",
      style: { stopColor: fill, stopOpacity: gradientToOpacity }
    }
  ) : null), strokeStops ? /* @__PURE__ */ React.createElement(
    "linearGradient",
    {
      id: strokeGradientId,
      ...viewportFadeGradientAttrs(innerWidth)
    },
    strokeStops.map((stop) => /* @__PURE__ */ React.createElement(
      "stop",
      {
        key: stop.offset,
        offset: stop.offset,
        style: { stopColor: resolvedStroke, stopOpacity: stop.opacity }
      }
    ))
  ) : null, edgeStops ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "linearGradient",
    {
      id: edgeGradientId,
      ...viewportFadeGradientAttrs(innerWidth)
    },
    edgeStops.map((stop) => /* @__PURE__ */ React.createElement(
      "stop",
      {
        key: stop.offset,
        offset: stop.offset,
        style: { stopColor: "white", stopOpacity: stop.opacity }
      }
    ))
  ), /* @__PURE__ */ React.createElement("mask", { id: edgeMaskId }, /* @__PURE__ */ React.createElement(
    "rect",
    {
      fill: `url(#${edgeGradientId})`,
      height: innerHeight,
      width: innerWidth,
      x: "0",
      y: "0"
    }
  ))) : null);
}
export {
  AreaGradientDefs
};
