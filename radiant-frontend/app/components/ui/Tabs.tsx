"use client"

import * as TabsPrimitive from "@radix-ui/react-tabs"
import * as React from "react"

import { groteskFont, tomorrowFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref}
		className={cn(
			"inline-flex gap-2 border-3 border-neo-black bg-surface-muted p-2 shadow-neo-badge",
			className,
		)}
		{...props}
	/>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			`inline-flex min-w-[8rem] items-center justify-center border-3 border-transparent px-3 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-black/70 outline-none data-[state=active]:border-neo-black data-[state=active]:bg-white data-[state=active]:text-neo-black data-[state=active]:shadow-neo-badge ${tomorrowFont.className} ${groteskFont.className}`,
			className,
		)}
		{...props}
	/>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content ref={ref} className={cn("mt-4 outline-none", className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }
