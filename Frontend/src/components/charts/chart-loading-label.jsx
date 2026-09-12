"use client";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { ShimmeringText } from "../shimmering-text";
import {
  LINE_LOADING_PULSE_EASE,
  LOADING_LABEL_EXIT_S,
  LOADING_LABEL_EXIT_Y_PX
} from "./line-loading-timing";
import * as React from "react";
function ChartLoadingLabel({
  text = "Loading",
  className,
  exiting = false
}) {
  if (!text.trim()) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(
    motion.div,
    {
      animate: {
        y: exiting ? LOADING_LABEL_EXIT_Y_PX : 0,
        opacity: exiting ? 0 : 1,
        filter: exiting ? "blur(2px)" : "blur(0px)"
      },
      "aria-live": "polite",
      className: cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      ),
      initial: false,
      role: "status",
      transition: {
        duration: LOADING_LABEL_EXIT_S,
        ease: [...LINE_LOADING_PULSE_EASE]
      }
    },
    /* @__PURE__ */ React.createElement(
      ShimmeringText,
      {
        className: "font-medium text-sm tracking-wide [--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]",
        text
      }
    )
  );
}
var chart_loading_label_default = ChartLoadingLabel;
export {
  ChartLoadingLabel,
  chart_loading_label_default as default
};
