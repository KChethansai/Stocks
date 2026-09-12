"use client";
import { motion, useSpring } from "motion/react";
import { memo, useMemo, useRef } from "react";
import * as React from "react";
const TICKER_ITEM_HEIGHT = 24;
const COMPACT_TICKER_THRESHOLD = 60;
const DateTickerCompact = memo(function DateTickerCompact2({
  currentIndex,
  labels
}) {
  const label = labels[currentIndex] ?? labels[0] ?? "";
  return /* @__PURE__ */ React.createElement("div", { className: "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900" }, /* @__PURE__ */ React.createElement("div", { className: "flex h-6 items-center justify-center" }, /* @__PURE__ */ React.createElement("span", { className: "whitespace-nowrap font-medium text-sm" }, label)));
});
const DateTickerInner = memo(function DateTickerInner2({
  currentIndex,
  labels
}) {
  const parsedLabels = useMemo(() => {
    return labels.map((label, index) => {
      const parts = label.split(" ");
      const month = parts[0] || "";
      const day = parts[1] || "";
      return { month, day, full: label, key: `${label}::${index}` };
    });
  }, [labels]);
  const monthSegments = useMemo(() => {
    const segments = [];
    parsedLabels.forEach((label, index) => {
      const prev = segments.at(-1);
      if (!prev || prev.month !== label.month) {
        segments.push({
          month: label.month,
          key: `${label.month}-${index}`,
          startIndex: index
        });
      }
    });
    return segments;
  }, [parsedLabels]);
  const currentMonthIndex = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
      return 0;
    }
    for (let i = monthSegments.length - 1; i >= 0; i--) {
      const segment = monthSegments[i];
      if (segment && segment.startIndex <= currentIndex) {
        return i;
      }
    }
    return 0;
  }, [currentIndex, parsedLabels.length, monthSegments]);
  const prevMonthIndexRef = useRef(-1);
  const dayY = useSpring(0, { stiffness: 400, damping: 35 });
  const monthY = useSpring(0, { stiffness: 400, damping: 35 });
  dayY.set(-currentIndex * TICKER_ITEM_HEIGHT);
  if (currentMonthIndex >= 0) {
    const isFirstRender = prevMonthIndexRef.current === -1;
    const monthChanged = prevMonthIndexRef.current !== currentMonthIndex;
    if (isFirstRender || monthChanged) {
      monthY.set(-currentMonthIndex * TICKER_ITEM_HEIGHT);
      prevMonthIndexRef.current = currentMonthIndex;
    }
  }
  return /* @__PURE__ */ React.createElement("div", { className: "overflow-hidden rounded-full bg-zinc-900 px-4 py-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900" }, /* @__PURE__ */ React.createElement("div", { className: "relative h-6 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center gap-1" }, /* @__PURE__ */ React.createElement("div", { className: "relative h-6 overflow-hidden" }, /* @__PURE__ */ React.createElement(motion.div, { className: "flex flex-col", style: { y: monthY } }, monthSegments.map((segment) => /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "flex h-6 shrink-0 items-center justify-center",
      key: segment.key
    },
    /* @__PURE__ */ React.createElement("span", { className: "whitespace-nowrap font-medium text-sm" }, segment.month)
  )))), /* @__PURE__ */ React.createElement("div", { className: "relative h-6 overflow-hidden" }, /* @__PURE__ */ React.createElement(motion.div, { className: "flex flex-col", style: { y: dayY } }, parsedLabels.map((label) => /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "flex h-6 shrink-0 items-center justify-center",
      key: label.key
    },
    /* @__PURE__ */ React.createElement("span", { className: "whitespace-nowrap font-medium text-sm" }, label.day)
  )))))));
});
function DateTicker({ currentIndex, labels, visible }) {
  if (!visible || labels.length === 0) {
    return null;
  }
  if (labels.length > COMPACT_TICKER_THRESHOLD) {
    return /* @__PURE__ */ React.createElement(DateTickerCompact, { currentIndex, labels });
  }
  return /* @__PURE__ */ React.createElement(DateTickerInner, { currentIndex, labels });
}
DateTicker.displayName = "DateTicker";
var date_ticker_default = DateTicker;
export {
  DateTicker,
  date_ticker_default as default
};
