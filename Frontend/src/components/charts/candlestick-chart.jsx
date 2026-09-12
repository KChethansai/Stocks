"use client";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector } from "d3-array";
import {
  Children,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { cn } from "../../lib/utils";
import {
  isClipExcludedComponent,
  isPostOverlayComponent,
  isUnderlayComponent
} from "./chart-child-passthrough";
import { ChartProvider } from "./chart-context";
import { shortDateFmt } from "./chart-formatters";
import { DEFAULT_CHART_LIFECYCLE } from "./chart-phase";
import {
  decimateOhlcData,
  maxRenderPointsForWidth
} from "./decimate-time-series";
import { extractReferenceAreaConfigs } from "./reference-area-config";
import { useChartInteraction } from "./use-chart-interaction";
import { wrapSingleYScale } from "./y-axis-scales";
import * as React from "react";
const DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
function ChartInner(props) {
  const { width, height } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(ChartCore, { ...props });
}
const ChartCore = memo(function ChartCore2({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  enterTransition,
  revealSignature = "",
  candleGap,
  candleWidthProp,
  xDomain,
  xDomainSlotCount,
  children,
  containerRef
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xAccessor = useCallback(
    (d) => {
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value);
    },
    [xDataKey]
  );
  const bisectDate = useMemo(
    () => bisector((d) => xAccessor(d)).left,
    [xAccessor]
  );
  const slotCount = xDomain && xDomainSlotCount != null ? xDomainSlotCount : data.length;
  const slotWidth = innerWidth / Math.max(slotCount, 1);
  const xScale = useMemo(() => {
    const minTime = xDomain ? xDomain[0].getTime() : Math.min(...data.map((d) => xAccessor(d).getTime()));
    const maxTime = xDomain ? xDomain[1].getTime() : Math.max(...data.map((d) => xAccessor(d).getTime()));
    const padding = slotWidth / 2;
    return scaleTime({
      range: [padding, innerWidth - padding],
      domain: [minTime, maxTime]
    });
  }, [innerWidth, data, xAccessor, slotWidth, xDomain]);
  const yScale = useMemo(() => {
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;
    for (const d of data) {
      const low = d.low;
      const high = d.high;
      if (typeof low === "number" && low < minVal) {
        minVal = low;
      }
      if (typeof high === "number" && high > maxVal) {
        maxVal = high;
      }
    }
    if (minVal === Number.POSITIVE_INFINITY) {
      minVal = 0;
    }
    if (maxVal === Number.NEGATIVE_INFINITY) {
      maxVal = 100;
    }
    const padding = (maxVal - minVal) * 0.05 || 1;
    return scaleLinear({
      range: [innerHeight, 0],
      domain: [minVal - padding, maxVal + padding],
      nice: true
    });
  }, [innerHeight, data]);
  const columnWidth = slotWidth;
  const bandWidth = candleWidthProp ?? slotWidth * (1 - candleGap);
  const lines = useMemo(
    () => [
      { dataKey: "close", stroke: "var(--chart-line-primary)", strokeWidth: 0 }
    ],
    []
  );
  const renderData = useMemo(
    () => decimateOhlcData(data, maxRenderPointsForWidth(innerWidth)),
    [data, innerWidth]
  );
  const dateLabels = useMemo(
    () => data.map((d) => shortDateFmt.format(xAccessor(d))),
    [data, xAccessor]
  );
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timer = setTimeout(() => setIsLoaded(true), animationDuration);
    return () => clearTimeout(timer);
  }, [animationDuration, revealSignature]);
  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle
  } = useChartInteraction({
    xScale,
    yScale,
    yScales: wrapSingleYScale(yScale),
    data,
    lines,
    margin,
    xAccessor,
    bisectDate,
    canInteract: isLoaded
  });
  const hoveredCandleIndex = tooltipData?.index ?? null;
  const isDefsComponent = (child) => {
    const displayName = child.type?.displayName || child.type?.name || "";
    return displayName.includes("Gradient") || displayName.includes("Pattern") || displayName === "LinearGradient" || displayName === "RadialGradient" || displayName === "Lines" || displayName === "PatternLines";
  };
  const defsChildren = [];
  const clipExcludedChildren = [];
  const underlayChildren = [];
  const preOverlayChildren = [];
  const postOverlayChildren = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    if (isDefsComponent(child)) {
      defsChildren.push(child);
    } else if (isPostOverlayComponent(child)) {
      postOverlayChildren.push(child);
    } else if (isClipExcludedComponent(child)) {
      clipExcludedChildren.push(child);
    } else if (isUnderlayComponent(child)) {
      underlayChildren.push(child);
    } else {
      preOverlayChildren.push(child);
    }
  });
  const referenceAreas = useMemo(
    () => extractReferenceAreaConfigs(children),
    [children]
  );
  const yScales = useMemo(() => wrapSingleYScale(yScale), [yScale]);
  const contextValue = useMemo(
    () => ({
      ...DEFAULT_CHART_LIFECYCLE,
      data,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      referenceAreas,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
      xAccessor,
      dateLabels,
      selection: selection ?? null,
      clearSelection,
      bandWidth,
      hoveredCandleIndex
    }),
    [
      data,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      referenceAreas,
      isLoaded,
      animationDuration,
      enterTransition,
      revealEpoch,
      xAccessor,
      dateLabels,
      selection,
      clearSelection,
      bandWidth,
      hoveredCandleIndex
    ]
  );
  return /* @__PURE__ */ React.createElement(ChartProvider, { value: contextValue }, /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", height, width }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "candlestick-positive", x1: "0", x2: "0", y1: "1", y2: "0" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "var(--color-emerald-500)" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "var(--color-emerald-500)" })), /* @__PURE__ */ React.createElement("linearGradient", { id: "candlestick-negative", x1: "0", x2: "0", y1: "1", y2: "0" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "var(--color-red-500)" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "var(--color-red-500)" })), defsChildren), /* @__PURE__ */ React.createElement("rect", { fill: "transparent", height, width, x: 0, y: 0 }), /* @__PURE__ */ React.createElement(
    "g",
    {
      ...interactionHandlers,
      style: interactionStyle,
      transform: `translate(${margin.left},${margin.top})`
    },
    /* @__PURE__ */ React.createElement(
      "rect",
      {
        fill: "transparent",
        height: innerHeight,
        width: innerWidth,
        x: 0,
        y: 0
      }
    ),
    clipExcludedChildren,
    underlayChildren,
    preOverlayChildren,
    postOverlayChildren
  )));
});
function CandlestickChart({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = 1100,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className = "",
  style,
  candleGap = 0.2,
  candleWidth,
  xDomain,
  xDomainSlotCount,
  children
}) {
  const containerRef = useRef(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const dataAsRecords = data;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: cn("relative w-full", className),
      ref: containerRef,
      style: { aspectRatio, touchAction: "none", ...style }
    },
    /* @__PURE__ */ React.createElement(ParentSize, { debounceTime: 10 }, ({ width, height }) => /* @__PURE__ */ React.createElement(
      ChartInner,
      {
        animationDuration,
        candleGap,
        candleWidthProp: candleWidth,
        containerRef,
        data: dataAsRecords,
        enterTransition,
        height,
        margin,
        revealSignature,
        width,
        xDataKey,
        xDomain,
        xDomainSlotCount
      },
      children
    ))
  );
}
CandlestickChart.displayName = "CandlestickChart";
var candlestick_chart_default = CandlestickChart;
export {
  CandlestickChart,
  candlestick_chart_default as default
};
