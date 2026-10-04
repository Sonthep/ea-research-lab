import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("ui-button", { variants: { variant: { default: "ui-button-primary", outline: "ui-button-outline", ghost: "ui-button-ghost" }, size: { default: "ui-button-default", sm: "ui-button-sm", icon: "ui-button-icon" } }, defaultVariants: { variant: "default", size: "default" } });
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(variants({ variant, size, className }))} {...props} />;
}
