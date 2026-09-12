"use client";
import { GridColumns, GridRows } from "@visx/grid";
import { motion } from "motion/react";
import { useId } from "react";
import { chartCssVars, useChartStable, useYScale } from "./chart-context";
import { useGridShimmer } from "./use-grid-shimmer";
import {
  isLoadingChromePhase,
  isLoadingGridChromePhase
} from "./y-domain-utils";
import * as React from "react";
const DEFAULT_SHIMMER_LENGTH_PX = 140;
const DEFAULT_SHIMMER_SPEED = 1;
const DEFAULT_SHIMMER_STROKE = "color-mix(in oklch, var(--foreground) 68%, transparent)";
function hideEdgeTicks(ticks, hideEdgeLines) {
  if (!hideEdgeLines || ticks.length <= 2) {
    return ticks;
  }
  return ticks.slice(1, -1);
}
function resolveRowTickValues(options) {
  const { hideHorizontalEdgeLines, numTicksRows, rowTickValues, yScale } = options;
  const ticks = rowTickValues ?? (yScale.ticks ? yScale.ticks(numTicksRows) : []);
  const filtered = hideEdgeTicks(ticks, hideHorizontalEdgeLines);
  if (filtered === ticks && !rowTickValues && !hideHorizontalEdgeLines) {
    return void 0;
  }
  return filtered.length > 0 ? filtered : void 0;
}
function Grid({
  horizontal = true,
  vertical = false,
  numTicksRows = 5,
  numTicksColumns = 10,
  rowTickValues,
  stroke = chartCssVars.grid,
  loadingStroke,
  strokeOpacity = 1,
  strokeWidth = 1,
  strokeDasharray = "4,4",
  highlightRowValues,
  highlightRowStroke = chartCssVars.foregroundMuted,
  highlightRowStrokeOpacity = 1,
  highlightRowStrokeWidth = 1,
  highlightRowStrokeDasharray = "0",
  fadeHorizontal = true,
  fadeVertical = false,
  hideHorizontalEdgeLines = false,
  hideVerticalEdgeLines = false,
  yAxisId,
  shimmer = false,
  shimmerStroke = DEFAULT_SHIMMER_STROKE,
  shimmerLength = DEFAULT_SHIMMER_LENGTH_PX,
  shimmerSpeed = DEFAULT_SHIMMER_SPEED,
  shimmerSync = false
}) {
  const { xScale, innerWidth, innerHeight, orientation, barScale, chartPhase } = useChartStable();
  const yScale = useYScale(yAxisId);
  const shimmerActive = shimmer && isLoadingChromePhase(chartPhase);
  const gridStroke = isLoadingGridChromePhase(chartPhase) && loadingStroke != null ? loadingStroke : stroke;
  const { shimmerEnabled, shimmerTransform } = useGridShimmer({
    innerWidth,
    shimmer,
    shimmerLength,
    shimmerSpeed,
    shimmerSync,
    active: shimmerActive
  });
  const isHorizontalBarChart = orientation === "horizontal" && barScale;
  const columnScale = isHorizontalBarChart ? yScale : xScale;
  const rowTickValuesResolved = resolveRowTickValues({
    hideHorizontalEdgeLines,
    numTicksRows,
    rowTickValues,
    yScale
  });
  const columnTickValuesResolved = vertical && columnScale && typeof columnScale === "function" && hideVerticalEdgeLines ? (() => {
    const ticks = columnScale.ticks?.(numTicksColumns) ?? [];
    const filtered = hideEdgeTicks(ticks, true);
    return filtered.length > 0 ? filtered : void 0;
  })() : void 0;
  const uniqueId = useId();
  const hMaskId = `grid-rows-fade-${uniqueId}`;
  const hGradientId = `${hMaskId}-gradient`;
  const shimmerGradientId = `grid-shimmer-${uniqueId}`;
  const vMaskId = `grid-cols-fade-${uniqueId}`;
  const vGradientId = `${vMaskId}-gradient`;
  const horizontalFadeMask = fadeHorizontal ? `url(#${hMaskId})` : void 0;
  return /* @__PURE__ */ React.createElement("g", { className: "chart-grid" }, horizontal && fadeHorizontal && /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: hGradientId, x1: "0%", x2: "100%", y1: "0%", y2: "0%" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", style: { stopColor: "white", stopOpacity: 0 } }), /* @__PURE__ */ React.createElement("stop", { offset: "10%", style: { stopColor: "white", stopOpacity: 1 } }), /* @__PURE__ */ React.createElement("stop", { offset: "90%", style: { stopColor: "white", stopOpacity: 1 } }), /* @__PURE__ */ React.createElement(
    "stop",
    {
      offset: "100%",
      style: { stopColor: "white", stopOpacity: 0 }
    }
  )), /* @__PURE__ */ React.createElement("mask", { id: hMaskId }, /* @__PURE__ */ React.createElement(
    "rect",
    {
      fill: `url(#${hGradientId})`,
      height: innerHeight,
      width: innerWidth,
      x: "0",
      y: "0"
    }
  ))), horizontal && shimmerEnabled ? /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement(
    motion.linearGradient,
    {
      gradientTransform: shimmerTransform,
      gradientUnits: "userSpaceOnUse",
      id: shimmerGradientId,
      x1: 0,
      x2: shimmerLength,
      y1: 0,
      y2: 0
    },
    /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: shimmerStroke, stopOpacity: 0 }),
    /* @__PURE__ */ React.createElement("stop", { offset: "35%", stopColor: shimmerStroke, stopOpacity: 0.45 }),
    /* @__PURE__ */ React.createElement("stop", { offset: "50%", stopColor: shimmerStroke, stopOpacity: 1 }),
    /* @__PURE__ */ React.createElement("stop", { offset: "65%", stopColor: shimmerStroke, stopOpacity: 0.45 }),
    /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: shimmerStroke, stopOpacity: 0 })
  )) : null, vertical && fadeVertical && /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: vGradientId, x1: "0%", x2: "0%", y1: "0%", y2: "100%" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", style: { stopColor: "white", stopOpacity: 0 } }), /* @__PURE__ */ React.createElement("stop", { offset: "10%", style: { stopColor: "white", stopOpacity: 1 } }), /* @__PURE__ */ React.createElement("stop", { offset: "90%", style: { stopColor: "white", stopOpacity: 1 } }), /* @__PURE__ */ React.createElement(
    "stop",
    {
      offset: "100%",
      style: { stopColor: "white", stopOpacity: 0 }
    }
  )), /* @__PURE__ */ React.createElement("mask", { id: vMaskId }, /* @__PURE__ */ React.createElement(
    "rect",
    {
      fill: `url(#${vGradientId})`,
      height: innerHeight,
      width: innerWidth,
      x: "0",
      y: "0"
    }
  ))), horizontal && /* @__PURE__ */ React.createElement("g", { mask: horizontalFadeMask }, /* @__PURE__ */ React.createElement(
    GridRows,
    {
      numTicks: rowTickValuesResolved ? void 0 : numTicksRows,
      scale: yScale,
      stroke: gridStroke,
      strokeDasharray,
      strokeOpacity,
      strokeWidth,
      tickValues: rowTickValuesResolved,
      width: innerWidth
    }
  ), shimmerEnabled ? /* @__PURE__ */ React.createElement(
    GridRows,
    {
      numTicks: rowTickValuesResolved ? void 0 : numTicksRows,
      scale: yScale,
      stroke: `url(#${shimmerGradientId})`,
      strokeDasharray,
      strokeOpacity: 1,
      strokeWidth,
      tickValues: rowTickValuesResolved,
      width: innerWidth
    }
  ) : null), horizontal && highlightRowValues && highlightRowValues.length > 0 ? /* @__PURE__ */ React.createElement("g", { className: "chart-grid-highlight-rows" }, highlightRowValues.map((value) => {
    const y = yScale(value);
    if (y == null || !Number.isFinite(y)) {
      return null;
    }
    return /* @__PURE__ */ React.createElement(
      "line",
      {
        key: value,
        stroke: highlightRowStroke,
        strokeDasharray: highlightRowStrokeDasharray,
        strokeOpacity: highlightRowStrokeOpacity,
        strokeWidth: highlightRowStrokeWidth,
        x1: 0,
        x2: innerWidth,
        y1: y,
        y2: y
      }
    );
  })) : null, vertical && columnScale && typeof columnScale === "function" && /* @__PURE__ */ React.createElement("g", { mask: fadeVertical ? `url(#${vMaskId})` : void 0 }, /* @__PURE__ */ React.createElement(
    GridColumns,
    {
      height: innerHeight,
      numTicks: columnTickValuesResolved ? void 0 : numTicksColumns,
      scale: columnScale,
      stroke,
      strokeDasharray,
      strokeOpacity,
      strokeWidth,
      tickValues: columnTickValuesResolved
    }
  )));
}
Grid.displayName = "Grid";
var grid_default = Grid;
export {
  Grid,
  grid_default as default
};
