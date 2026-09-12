"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback } from "react";
import { cn } from "../../lib/utils";
import * as React from "react";
function ShimmeringText({
  text,
  duration = 1,
  isStopped = false,
  paused = false,
  className,
  ...props
}) {
  const reducedMotion = useReducedMotion();
  const stopped = isStopped || paused || reducedMotion === true;
  const createCharVariants = useCallback(
    (charIndex) => ({
      running: {
        color: ["var(--color)", "var(--shimmering-color)", "var(--color)"],
        transition: {
          duration,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "loop",
          repeatDelay: text.length * 0.05,
          delay: charIndex * duration / text.length,
          ease: "easeInOut"
        }
      },
      stopped: {
        color: "var(--color)",
        transition: {
          duration: duration * 0.5,
          ease: "easeOut"
        }
      }
    }),
    [duration, text.length]
  );
  return /* @__PURE__ */ React.createElement(
    motion.span,
    {
      className: cn(
        "inline-flex select-none items-center leading-none",
        "[--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]",
        className
      ),
      ...props
    },
    text.split("").map((char, index) => /* @__PURE__ */ React.createElement(
      motion.span,
      {
        animate: stopped ? "stopped" : "running",
        "aria-hidden": true,
        className: "inline-block whitespace-pre leading-none",
        initial: "stopped",
        key: index,
        variants: createCharVariants(index)
      },
      char
    )),
    /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, text)
  );
}
export {
  ShimmeringText
};
