"use client";
import { curveMonotoneX } from "@visx/curve";
import { AreaClosed, LinePath } from "@visx/shape";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { AreaGradientDefs } from "./area-gradient-defs";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import { resolveFadeSides } from "./fade-edges";
import {
  LineLoadingPulseStroke,
  resolveLineLoadingPulseMode
} from "./line-loading-pulse";
import { LINE_LOADING_LOOP_PAUSE_MS } from "./line-loading-timing";
import { LineLoadingSweep } from "./loading-sweep";
import {
  resolveDashTailBounds,
  usePathStrokeMetrics
} from "./path-stroke-utils";
import { SeriesDashTailOverlay } from "./series-dash-tail-overlay";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";
import { SeriesMarkers } from "./series-markers";
import * as React from "react";
function useAreaLoadingPulseState(chartPhase, loading, loadingPulseMode, notifyLoadingPulseComplete) {
  const phasePulseMode = resolveLineLoadingPulseMode(chartPhase);
  const pulseMode = loading === false ? null : loadingPulseMode ?? (loading === true ? "loop" : phasePulseMode);
  const showLoadingPulse = pulseMode != null;
  const showSeriesContent = chartPhase === "revealing" || chartPhase === "ready" || chartPhase === "exitingReady";
  const [pulseEpoch, setPulseEpoch] = useState(0);
  const handleLoadingPulseComplete = useCallback(() => {
    if (pulseMode === "loop") {
      window.setTimeout(() => {
        setPulseEpoch((epoch) => epoch + 1);
      }, LINE_LOADING_LOOP_PAUSE_MS);
      return;
    }
    notifyLoadingPulseComplete?.();
  }, [notifyLoadingPulseComplete, pulseMode]);
  return {
    handleLoadingPulseComplete,
    pulseMode,
    pulseEpoch,
    showLoadingPulse,
    showSeriesContent
  };
}
function Area({
  dataKey,
  yAxisId,
  fill = chartCssVars.linePrimary,
  fillOpacity = 0.4,
  stroke,
  strokeWidth = 2,
  curve = curveMonotoneX,
  animate = true,
  showLine = true,
  showHighlight = true,
  gradientToOpacity = 0,
  gradientSpan = 1,
  fadeEdges = false,
  showMarkers = false,
  markers,
  dashFromIndex,
  dashArray = "6,4",
  loading,
  loadingStroke = chartCssVars.foreground,
  loadingStrokeOpacity = 0.5,
  loadingPulseMode,
  loadingStyle = "pulse"
}) {
  const {
    data,
    renderData,
    xScale,
    innerHeight,
    innerWidth,
    xAccessor,
    lines,
    chartPhase,
    notifyLoadingPulseComplete
  } = useChartStable();
  const yScale = useYScale(yAxisId);
  const {
    handleLoadingPulseComplete,
    pulseMode,
    pulseEpoch,
    showLoadingPulse,
    showSeriesContent
  } = useAreaLoadingPulseState(
    chartPhase,
    loading,
    loadingPulseMode,
    notifyLoadingPulseComplete
  );
  const seriesIndex = useMemo(() => {
    const index = lines.findIndex((line) => line.dataKey === dataKey);
    return index >= 0 ? index : 0;
  }, [lines, dataKey]);
  const pathRef = useRef(null);
  const { pathLength, pathD } = usePathStrokeMetrics(pathRef, [
    renderData,
    innerWidth,
    dashFromIndex,
    showLine,
    showSeriesContent,
    showLoadingPulse
  ]);
  const uniqueId = useId();
  const gradientId = `area-gradient-${dataKey}-${uniqueId}`;
  const strokeGradientId = `area-stroke-gradient-${dataKey}-${uniqueId}`;
  const edgeMaskId = `area-edge-mask-${dataKey}-${uniqueId}`;
  const edgeGradientId = `${edgeMaskId}-gradient`;
  const isPatternFill = fill.startsWith("url(");
  const showAreaFill = isPatternFill || fillOpacity > 0;
  const areaFill = isPatternFill ? fill : `url(#${gradientId})`;
  const resolvedStroke = stroke || (isPatternFill ? chartCssVars.linePrimary : fill);
  const getY = useCallback(
    (d) => {
      const value = d[dataKey];
      return typeof value === "number" ? yScale(value) ?? 0 : 0;
    },
    [dataKey, yScale]
  );
  const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
  const fadeSides = resolveFadeSides(fadeEdges);
  const useViewportEdgeFade = fadeSides.any && !isPatternFill;
  let strokePaint = resolvedStroke;
  if (!useViewportEdgeFade && fadeSides.any) {
    strokePaint = `url(#${strokeGradientId})`;
  }
  const highlightEnabled = showHighlight && showLine && !showLoadingPulse && showSeriesContent;
  const showSeriesStroke = showSeriesContent && showLine;
  let visibleStroke = "transparent";
  if (showSeriesStroke && !hasDashTail) {
    visibleStroke = strokePaint;
  }
  const shouldMeasurePath = showLine && (showSeriesContent || showLoadingPulse);
  const seriesLayers = /* @__PURE__ */ React.createElement(React.Fragment, null, showSeriesContent && showAreaFill ? /* @__PURE__ */ React.createElement(
    AreaClosed,
    {
      curve,
      data: renderData,
      fill: areaFill,
      x: (d) => xScale(xAccessor(d)) ?? 0,
      y: getY,
      yScale
    }
  ) : null, shouldMeasurePath ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    LinePath,
    {
      curve,
      data: renderData,
      innerRef: pathRef,
      stroke: visibleStroke,
      strokeLinecap: "round",
      strokeWidth,
      x: (d) => xScale(xAccessor(d)) ?? 0,
      y: getY
    }
  ), showSeriesStroke ? /* @__PURE__ */ React.createElement(
    SeriesDashTailOverlay,
    {
      dashArray,
      dashFromIndex,
      data,
      innerHeight,
      innerWidth,
      pathD,
      pathLength,
      stroke: strokePaint,
      strokeWidth,
      xAccessor,
      xScale
    }
  ) : null) : null);
  const sweepLoading = showLoadingPulse && innerWidth > 0 && loadingStyle === "sweep";
  const pulseLoading = showLoadingPulse && innerWidth > 0 && !sweepLoading;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    AreaGradientDefs,
    {
      edgeGradientId,
      edgeMaskId,
      fadeEdges,
      fill,
      fillOpacity,
      gradientId,
      gradientSpan,
      gradientToOpacity,
      innerHeight,
      innerWidth,
      isPatternFill,
      resolvedStroke,
      strokeGradientId
    }
  ), /* @__PURE__ */ React.createElement(
    SeriesHoverDim,
    {
      dimOpacity: 0.6,
      enabled: showHighlight,
      seriesIndex
    },
    useViewportEdgeFade ? /* @__PURE__ */ React.createElement("g", { mask: `url(#${edgeMaskId})` }, seriesLayers) : seriesLayers
  ), /* @__PURE__ */ React.createElement(
    SeriesHighlightLayer,
    {
      enabled: highlightEnabled,
      height: innerHeight,
      pathRef,
      stroke: resolvedStroke,
      strokeWidth
    }
  ), showMarkers && showSeriesContent ? /* @__PURE__ */ React.createElement(
    SeriesMarkers,
    {
      animate,
      dataKey,
      ...markers,
      fill: markers?.fill ?? resolvedStroke,
      stroke: markers?.stroke ?? markers?.fill ?? resolvedStroke
    }
  ) : null, sweepLoading ? /* @__PURE__ */ React.createElement(
    LineLoadingSweep,
    {
      curve,
      key: "loading-sweep",
      mode: pulseMode ?? "loop",
      onTransitionComplete: handleLoadingPulseComplete,
      stroke: loadingStroke,
      strokeOpacity: loadingStrokeOpacity,
      strokeWidth,
      withArea: true
    }
  ) : null, pulseLoading && pathD ? /* @__PURE__ */ React.createElement(
    LineLoadingPulseStroke,
    {
      key: "loading-pulse",
      loopEpoch: pulseEpoch,
      mode: pulseMode ?? void 0,
      onCycleComplete: handleLoadingPulseComplete,
      pathD,
      stroke: loadingStroke,
      strokeOpacity: loadingStrokeOpacity,
      strokeWidth
    }
  ) : null);
}
Area.displayName = "Area";
var area_default = Area;
export {
  Area,
  area_default as default
};
