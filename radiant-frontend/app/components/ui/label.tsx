"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const Label = React.forwardRef<
	React.ElementRef<typeof LabelPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
	<LabelPrimitive.Root
		ref={ref}
		className={cn(`text-[10px] font-extrabold uppercase tracking-[0.2em] text-black/55 ${tomorrowFont.className}`, className)}
		{...props}
	/>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
