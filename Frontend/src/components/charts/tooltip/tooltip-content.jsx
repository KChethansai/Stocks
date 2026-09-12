"use client";
import { intFmt } from "../chart-formatters";
import * as React from "react";
function TooltipContent({ title, rows, children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-3 py-2.5" }, title && /* @__PURE__ */ React.createElement("div", { className: "mb-2 text-left font-medium text-chart-tooltip-foreground text-xs" }, title), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, rows.map((row) => /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "flex items-center justify-between gap-4",
      key: `${row.label}-${row.color}`
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "h-2.5 w-2.5 shrink-0 rounded-full",
        style: { backgroundColor: row.color }
      }
    ), /* @__PURE__ */ React.createElement("span", { className: "text-chart-tooltip-muted text-sm" }, row.label)),
    /* @__PURE__ */ React.createElement("span", { className: "font-medium text-chart-tooltip-foreground text-sm tabular-nums" }, typeof row.value === "number" ? intFmt(row.value) : row.value)
  ))), children && /* @__PURE__ */ React.createElement("div", { className: "mt-2 transition-opacity duration-200 ease-out" }, children)));
}
TooltipContent.displayName = "TooltipContent";
var tooltip_content_default = TooltipContent;
export {
  TooltipContent,
  tooltip_content_default as default
};
