"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  showOutsideDays = true,
  style,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      style={{
        "--rdp-day-width": "2.25rem",
        "--rdp-day-height": "2.25rem",
        "--rdp-day_button-width": "2rem",
        "--rdp-day_button-height": "2rem",
        "--rdp-nav_button-width": "2rem",
        "--rdp-nav_button-height": "2rem",
        "--rdp-weekday-padding": "0.4rem 0",
        ...style,
      } as React.CSSProperties}
      className={cn(
        "p-3 [&_.rdp-selected_.rdp-day_button]:bg-primary [&_.rdp-selected_.rdp-day_button]:text-primary-foreground [&_.rdp-selected_.rdp-day_button]:hover:bg-primary [&_.rdp-day_button]:rounded-lg [&_.rdp-today_.rdp-day_button]:font-semibold [&_.rdp-chevron]:fill-none",
        className
      )}
      classNames={{
        ...defaultClassNames,
        root: cn(
          defaultClassNames.root,
          "bg-popover text-popover-foreground"
        ),
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="rdp-chevron h-4 w-4" />
          ) : (
            <ChevronRight className="rdp-chevron h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };