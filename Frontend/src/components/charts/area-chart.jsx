"use client";
import { ParentSize } from "@visx/responsive";
import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState
} from "react";
import { cn } from "../../lib/utils";
import { Area } from "./area";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase
} from "./chart-phase";
import { PatternArea } from "./pattern-area";
import { TimeSeriesChartInner } from "./time-series-chart-shell";
const DEFAULT_MARGIN = { top: 40, right: 40, bottom: 40, left: 40 };
function extractAreaConfigs(children) {
  const configs = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }
    const childType = child.type;
    const componentName = typeof child.type === "function" ? childType.displayName || childType.name || "" : "";
    const props = child.props;
    const isPatternArea = componentName === "PatternArea" || child.type === PatternArea;
    const isAreaComponent = componentName === "Area" || child.type === Area || props && typeof props.dataKey === "string" && props.dataKey.length > 0 && !isPatternArea;
    if (isAreaComponent && props?.dataKey) {
      configs.push({
        dataKey: props.dataKey,
        stroke: props.stroke || props.fill || "var(--chart-line-primary)",
        strokeWidth: props.strokeWidth || 2,
        yAxisId: props.yAxisId
      });
    }
  });
  return configs;
}
function ChartInner({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature,
  chartStatus,
  loadingLabel,
  yDomainTweenDuration,
  yDomainTween,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange,
  children,
  containerRef,
  onPhaseChange
}) {
  const lines = useMemo(() => extractAreaConfigs(children), [children]);
  return /* @__PURE__ */ React.createElement(
    TimeSeriesChartInner,
    {
      animationDuration,
      animationEasing,
      chartStatus,
      clipPathId: "chart-area-grow-clip",
      containerRef,
      data,
      enterTransition,
      height,
      lines,
      loadingLabel,
      margin,
      onPhaseChange,
      revealSignature,
      tweenYDomainOnXDomainChange,
      width,
      xDataKey,
      xDomain,
      xDomainSlotCount,
      yDomainTween,
      yDomainTweenDuration
    },
    children
  );
}
function AreaChart({
  data,
  xDataKey = "date",
  margin: marginProp,
  animationDuration = 1100,
  animationEasing,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  className = "",
  status = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  yDomainTween = true,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  style,
  onPhaseChange,
  children
}) {
  const containerRef = useRef(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const [chartPhase, setChartPhase] = useState(
    () => resolveRestingChartPhase(status)
  );
  const handlePhaseChange = useCallback(
    (phase) => {
      setChartPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange]
  );
  const showLoadingLabel = Boolean(
    loadingLabel?.trim() && (chartPhase === "loading" || chartPhase === "exiting" || chartPhase === "gridTweenReady" || chartPhase === "revealingLoading")
  );
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
        animationEasing,
        chartStatus: status,
        containerRef,
        data,
        enterTransition,
        height,
        loadingLabel,
        margin,
        onPhaseChange: handlePhaseChange,
        revealSignature,
        tweenYDomainOnXDomainChange,
        width,
        xDataKey,
        xDomain,
        xDomainSlotCount,
        yDomainTween,
        yDomainTweenDuration
      },
      children
    )),
    showLoadingLabel ? /* @__PURE__ */ React.createElement(
      ChartLoadingLabel,
      {
        exiting: chartPhase !== "loading",
        text: loadingLabel
      }
    ) : null
  );
}
import { Area as Area2 } from "./area";
import * as React from "react";
var area_chart_default = AreaChart;
export {
  Area2 as Area,
  AreaChart,
  area_chart_default as default
};
