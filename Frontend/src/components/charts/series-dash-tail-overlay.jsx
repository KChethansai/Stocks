"use client";
import { memo, useMemo } from "react";
import { DashTailStroke } from "./dash-tail-stroke";
import { resolveDashStartX, resolveDashTailBounds } from "./path-stroke-utils";
import * as React from "react";
function SeriesDashTailOverlayImpl({
  dashFromIndex,
  dashArray,
  data,
  pathD,
  pathLength,
  innerWidth,
  innerHeight,
  stroke,
  strokeWidth,
  xScale,
  xAccessor
}) {
  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  const dashStartX = useMemo(() => {
    if (!hasDashTail || dashFromIndex == null) {
      return 0;
    }
    return resolveDashStartX(data, dashFromIndex, xScale, xAccessor);
  }, [hasDashTail, dashFromIndex, data, xScale, xAccessor]);
  const dashStartLength = useMemo(() => {
    if (!hasDashTail || dashFromIndex == null || pathLength <= 0) {
      return 0;
    }
    return dashFromIndex / Math.max(1, data.length - 1) * pathLength;
  }, [hasDashTail, dashFromIndex, data.length, pathLength]);
  if (!hasDashTail || dashFromIndex == null || pathLength <= 0) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(
    DashTailStroke,
    {
      dashArray,
      dashStartLength,
      dashStartX,
      innerHeight,
      innerWidth,
      pathD,
      pathLength,
      stroke,
      strokeWidth
    }
  );
}
const SeriesDashTailOverlay = memo(SeriesDashTailOverlayImpl);
export {
  SeriesDashTailOverlay
};
