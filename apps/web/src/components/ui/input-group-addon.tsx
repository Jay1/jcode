"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

const inputGroupAddonVariants = cva(
  "[&_svg]:-mx-0.5 flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4.5 sm:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:[&_svg:not([class*='size-'])]:size-4 not-has-[button]:**:[svg:not([class*='opacity-'])]:opacity-80",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "order-last w-full justify-start px-[calc(--spacing(3)-1px)] pb-[calc(--spacing(3)-1px)] [.border-t]:pt-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "block-start":
          "order-first w-full justify-start px-[calc(--spacing(3)-1px)] pt-[calc(--spacing(3)-1px)] [.border-b]:pb-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "inline-end":
          "has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 order-last pe-[calc(--spacing(3)-1px)] has-[>kbd:last-child]:me-[-0.35rem] [[data-size=sm]+&]:pe-[calc(--spacing(2.5)-1px)]",
        "inline-start":
          "has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 order-first ps-[calc(--spacing(3)-1px)] has-[>kbd:last-child]:ms-[-0.35rem] [[data-size=sm]+&]:ps-[calc(--spacing(2.5)-1px)]",
      },
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest(
          "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']",
        );
        if (isInteractive) return;
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        const input = parent?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        );
        if (input && !parent?.querySelector("input:focus, textarea:focus")) {
          input.focus();
        }
      }}
      {...props}
    />
  );
}

export { InputGroupAddon };
