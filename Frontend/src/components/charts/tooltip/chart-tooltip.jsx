"use client";
import { motion, useSpring } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  resolveTooltipBoxMotion,
  useChartConfig
} from "../chart-config-context";
import {
  chartCssVars,
  useChart,
  useChartStable
} from "../chart-context";
import { weekdayDateFmt } from "../chart-formatters";
import { DateTicker } from "./date-ticker";
import { TooltipBox } from "./tooltip-box";
import { TooltipContent } from "./tooltip-content";
import { TooltipDot } from "./tooltip-dot";
import { TooltipIndicator } from "./tooltip-indicator";
import * as React from "react";
const ChartTooltipInner = memo(function ChartTooltipInner2({
  showDatePill = true,
  showCrosshair = true,
  showDots = true,
  dotVariant = "dot",
  dotSize = 5,
  dotRadiusFraction,
  dotScale = 1,
  dotStrokeWidth,
  indicatorColor: indicatorColorProp,
  content,
  rows: rowsRenderer,
  dotColor: dotColorProp,
  children,
  className = "",
  container,
  springConfig,
  matchCrosshair = false,
  damping,
  indicatorDasharray,
  indicatorFadeEdges,
  indicatorFadeLength,
  boxSpringConfig,
  panelStyle,
  backgroundColor
}) {
  const {
    tooltipData,
    width,
    height,
    innerHeight,
    margin,
    columnWidth,
    lines,
    xAccessor,
    dateLabels,
    containerRef,
    orientation,
    barXAccessor,
    bandWidth,
    squareSnap
  } = useChart();
  const { tooltipSpring } = useChartConfig();
  const isHorizontal = orientation === "horizontal";
  const discreteInteraction = dateLabels.length > 60;
  const resolvedDotSize = useMemo(() => {
    if (dotVariant !== "ring" || !bandWidth || lines.length === 0) {
      return dotSize * dotScale;
    }
    const seriesCount = lines.length;
    const gap = squareSnap?.groupGap ?? (seriesCount > 1 ? 4 : 0);
    const squareSize = (bandWidth - gap * (seriesCount - 1)) / seriesCount;
    return squareSize / 2 * dotScale;
  }, [
    bandWidth,
    dotScale,
    dotSize,
    dotVariant,
    lines.length,
    squareSnap?.groupGap
  ]);
  const boxMotion = useMemo(() => {
    if (boxSpringConfig) {
      return {
        animate: !discreteInteraction,
        springConfig: boxSpringConfig
      };
    }
    if (matchCrosshair) {
      return {
        animate: !discreteInteraction,
        springConfig: springConfig ?? tooltipSpring
      };
    }
    return resolveTooltipBoxMotion(damping);
  }, [
    boxSpringConfig,
    damping,
    discreteInteraction,
    matchCrosshair,
    springConfig,
    tooltipSpring
  ]);
  const visible = tooltipData !== null;
  const x = tooltipData?.x ?? 0;
  const xWithMargin = x + margin.left;
  const firstLineDataKey = lines[0]?.dataKey;
  const firstLineY = firstLineDataKey ? tooltipData?.yPositions[firstLineDataKey] ?? 0 : 0;
  const yWithMargin = firstLineY + margin.top;
  const tooltipRows = useMemo(() => {
    if (!tooltipData) {
      return [];
    }
    if (rowsRenderer) {
      return rowsRenderer(tooltipData.point);
    }
    return lines.map((line) => ({
      color: line.stroke,
      label: line.dataKey,
      value: tooltipData.point[line.dataKey] ?? 0
    }));
  }, [tooltipData, lines, rowsRenderer]);
  const resolveDotColor = useMemo(() => {
    return (line, index) => {
      if (rowsRenderer && tooltipRows[index]?.color) {
        return tooltipRows[index].color;
      }
      if (dotColorProp != null) {
        if (typeof dotColorProp === "function" && tooltipData) {
          return dotColorProp(tooltipData.point, line);
        }
        if (typeof dotColorProp === "string") {
          return dotColorProp;
        }
      }
      return line.stroke;
    };
  }, [dotColorProp, rowsRenderer, tooltipData, tooltipRows]);
  const indicatorColor = useMemo(() => {
    if (indicatorColorProp == null) {
      return chartCssVars.crosshair;
    }
    if (typeof indicatorColorProp === "function") {
      return tooltipData ? indicatorColorProp(tooltipData.point) : chartCssVars.crosshair;
    }
    return indicatorColorProp;
  }, [indicatorColorProp, tooltipData]);
  const title = useMemo(() => {
    if (!tooltipData) {
      return void 0;
    }
    if (barXAccessor) {
      return barXAccessor(tooltipData.point);
    }
    return weekdayDateFmt.format(xAccessor(tooltipData.point));
  }, [tooltipData, barXAccessor, xAccessor]);
  const tooltipContent = /* @__PURE__ */ React.createElement(React.Fragment, null, showCrosshair && /* @__PURE__ */ React.createElement(
    "svg",
    {
      "aria-hidden": "true",
      className: "pointer-events-none absolute inset-0",
      height: "100%",
      width: "100%"
    },
    /* @__PURE__ */ React.createElement("g", { transform: `translate(${margin.left},${margin.top})` }, /* @__PURE__ */ React.createElement(
      TooltipIndicator,
      {
        animate: !discreteInteraction,
        colorEdge: indicatorColor,
        colorMid: indicatorColor,
        columnWidth,
        fadeEdges: indicatorDasharray ? "none" : indicatorFadeEdges ?? "both",
        fadeLength: indicatorFadeLength,
        height: innerHeight,
        springConfig,
        strokeDasharray: indicatorDasharray,
        visible,
        width: "line",
        x
      }
    ))
  ), showDots && visible && !isHorizontal && /* @__PURE__ */ React.createElement(
    "svg",
    {
      "aria-hidden": "true",
      className: "pointer-events-none absolute inset-0",
      height: "100%",
      width: "100%"
    },
    /* @__PURE__ */ React.createElement("g", { transform: `translate(${margin.left},${margin.top})` }, lines.map((line, index) => /* @__PURE__ */ React.createElement(
      TooltipDot,
      {
        color: resolveDotColor(line, index),
        cornerRadiusFraction: dotVariant === "ring" ? dotRadiusFraction : void 0,
        key: line.dataKey,
        size: resolvedDotSize,
        springConfig,
        strokeColor: chartCssVars.background,
        strokeWidth: dotVariant === "ring" ? dotStrokeWidth : void 0,
        variant: dotVariant,
        visible,
        x: tooltipData?.xPositions?.[line.dataKey] ?? x,
        y: tooltipData?.yPositions[line.dataKey] ?? 0
      }
    )))
  ), /* @__PURE__ */ React.createElement(
    TooltipBox,
    {
      animate: boxMotion.animate,
      backgroundColor,
      className,
      containerHeight: height,
      containerRef,
      containerWidth: width,
      panelStyle,
      springConfig: boxMotion.springConfig,
      top: isHorizontal ? void 0 : margin.top,
      visible,
      x: xWithMargin,
      y: isHorizontal ? yWithMargin : margin.top
    },
    content && tooltipData ? content({
      point: tooltipData.point,
      index: tooltipData.index
    }) : !content && /* @__PURE__ */ React.createElement(TooltipContent, { rows: tooltipRows, title }, children)
  ), /* @__PURE__ */ React.createElement(
    DatePillTracker,
    {
      currentIndex: tooltipData?.index ?? 0,
      discreteInteraction,
      enabled: showDatePill && !isHorizontal,
      labels: dateLabels,
      springConfig,
      visible,
      xWithMargin
    }
  ));
  return createPortal(tooltipContent, container);
});
function ChartTooltip(props) {
  const { containerRef } = useChartStable();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(ChartTooltipInner, { ...props, container });
}
ChartTooltip.displayName = "ChartTooltip";
function DatePillTracker(props) {
  if (!(props.enabled && props.visible && props.labels.length > 0)) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(DatePillTrackerInner, { ...props });
}
function DatePillTrackerInner({
  labels,
  currentIndex,
  xWithMargin,
  discreteInteraction,
  springConfig,
  visible
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const animatedX = useSpring(xWithMargin, effectiveSpring);
  if (!discreteInteraction) {
    animatedX.set(xWithMargin);
  }
  useEffect(() => {
    animatedX.set(xWithMargin);
  }, [animatedX, visible]);
  return /* @__PURE__ */ React.createElement(
    motion.div,
    {
      className: "pointer-events-none absolute z-50",
      style: {
        left: discreteInteraction ? xWithMargin : animatedX,
        transform: "translateX(-50%)",
        bottom: 4
      }
    },
    /* @__PURE__ */ React.createElement(
      DateTicker,
      {
        currentIndex,
        labels,
        visible
      }
    )
  );
}
var chart_tooltip_default = ChartTooltip;
export {
  ChartTooltip,
  chart_tooltip_default as default
};
