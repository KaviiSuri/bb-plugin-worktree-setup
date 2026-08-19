import * as React from "react";

import { cn } from "../../lib/utils";

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type Size = "default" | "sm" | "lg" | "icon";

// Hover fill snaps in instantly and eases out lazily, so controls feel
// responsive on the way in without twitching on the way out.
const BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 hover:duration-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const VARIANTS: Record<Variant, string> = {
  default: "bg-foreground text-background hover:bg-foreground/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-transparent hover:bg-state-hover hover:text-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost:
    "hover:bg-state-hover hover:text-foreground aria-pressed:bg-state-active aria-pressed:text-foreground data-[state=open]:bg-state-active data-[state=open]:text-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

const SIZES: Record<Size, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9",
};

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  variant?: Variant;
  size?: Size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button };
