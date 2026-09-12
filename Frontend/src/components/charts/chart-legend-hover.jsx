"use client";
import { createContext, useContext, useMemo } from "react";
import * as React from "react";
const ChartLegendHoverContext = createContext(null);
function ChartLegendHoverProvider({
  hoveredIndex,
  onHoverChange,
  children
}) {
  const value = useMemo(
    () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
    [hoveredIndex, onHoverChange]
  );
  return /* @__PURE__ */ React.createElement(ChartLegendHoverContext.Provider, { value }, children);
}
function useChartLegendHover() {
  const context = useContext(ChartLegendHoverContext);
  return context ?? {
    hoveredIndex: null,
    setHoveredIndex: () => {
    }
  };
}
export {
  ChartLegendHoverProvider,
  useChartLegendHover
};
