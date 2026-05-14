"use client"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { groteskFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
	`inline-flex items-center justify-center border-black text-sm font-bold cursor-pointer tracking-tight text-black transition-all active:translate-1 active:rounded-sm active:border-transparent disabled:pointer-events-none disabled:opacity-50 focus:outline-none  not-active:hover:shadow-neo-button-accent-hover not-active:hover:-translate-1 not-active:focus-visible:shadow-neo-button-accent-hover not-active:focus-visible:-translate-1 not-active:focus-visible:brightness-90 ${groteskFont.className}`,
	{
		variants: {
			variant: {
				default: "border-5 bg-blue-300 not-active:shadow-neo-panel-mobile",
				secondary: "border-3 bg-neo-paper not-active:shadow-neo-badge",
				ghost: "border-3 bg-white not-active:shadow-neo-badge",
			},
			size: {
				default: "px-5 py-3",
				sm: "px-4 py-2 text-xs",
				lg: "px-6 py-4 text-base",
				icon: "h-10 w-10 px-0 py-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, onContextMenu, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return (
			<Comp
				ref={ref}
				className={cn(buttonVariants({ variant, size }), className)}
				{...props}
				onContextMenu={(event: React.MouseEvent<HTMLButtonElement>) => {
					event.preventDefault()
					onContextMenu?.(event)
				}}
			/>
		)
	},
)

Button.displayName = "Button"

export { Button, buttonVariants }
