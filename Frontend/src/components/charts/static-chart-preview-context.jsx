"use client";
import { createContext, useContext } from "react";
import * as React from "react";
const StaticChartPreviewContext = createContext(false);
function StaticChartPreviewProvider({
  children
}) {
  return /* @__PURE__ */ React.createElement(StaticChartPreviewContext.Provider, { value: true }, children);
}
function useStaticChartPreview() {
  return useContext(StaticChartPreviewContext);
}
export {
  StaticChartPreviewProvider,
  useStaticChartPreview
};
