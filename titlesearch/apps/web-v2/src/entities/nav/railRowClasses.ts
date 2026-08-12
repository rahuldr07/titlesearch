import { cva } from "class-variance-authority";

/**
 * THE GEOMETRY OF ONE RAIL ROW, as a pure function of its two states.
 */
export const railRowClasses = cva(
  "relative flex items-center gap-6 no-underline transition-all duration-150 text-[13.5px]",
  {
    variants: {
      collapsed: {
        true: "h-22 justify-center px-0 rounded-lg",
        false: "px-6 py-5 rounded-lg mx-4",
      },
      active: {
        true: "bg-white text-slate-900 shadow-sm font-semibold",
        false: "text-[#b0adbf] font-medium hover:text-white hover:bg-white/5",
      },
    },
    defaultVariants: { collapsed: false, active: false },
  },
);
