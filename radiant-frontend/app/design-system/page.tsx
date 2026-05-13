"use client"

import { notFound } from "next/navigation"
import matsuriCover from "../assets/まつり-foto.png"
import { RadiantLogo } from "../components/RadiantLogo"
import { PreviewCard } from "../components/design-system/PreviewCard"
import { HealthPanel } from "../components/design-system/HealthPanel"
import { LibrarySnapshotPanel } from "../components/design-system/LibrarySnapshotPanel"
import { PageHeader } from "../components/design-system/PageHeader"
import { Panel } from "../components/design-system/Panel"
import { PanelGrid } from "../components/design-system/PanelGrid"
import { QuickActionsPanel } from "../components/design-system/QuickActionsPanel"
import { ScheduleMiniPanel } from "../components/design-system/ScheduleMiniPanel"
import { StatusPill } from "../components/design-system/StatusPill"
import { UpcomingPanel } from "../components/design-system/UpcomingPanel"
import { Badge } from "../components/ui/Badge"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Checkbox } from "../components/ui/Checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/Dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/DropdownMenu"
import { EmptyState } from "../components/ui/EmptyState"
import { Input } from "../components/ui/Input"
import { Label } from "../components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/Popover"
import { ScrollArea } from "../components/ui/ScrollArea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "../components/ui/Select"
import { Separator } from "../components/ui/Separator"
import { Skeleton } from "../components/ui/Skeleton"
import { StatCard } from "../components/ui/StatCard"
import { Switch } from "../components/ui/Switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs"
import { Textarea } from "../components/ui/Textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/Tooltip"
import { VerticalSlider } from "../components/ui/VerticalSlider"
import { groteskFont, tomorrowFont } from "../lib/fonts"

const isDesignSystemEnabled = process.env.NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM === "true"

function SectionTitle(props: { title: string; description: string }) {
	return (
		<div className="mb-4">
			<p className={`text-[10px] font-extrabold uppercase tracking-[0.22em] text-black/55 ${groteskFont.className}`}>
				Showcase
			</p>
			<h2 className={`${tomorrowFont.className} mt-2 text-2xl font-extrabold uppercase text-neo-black`}>
				{props.title}
			</h2>
			<p className={`${groteskFont.className} mt-2 max-w-3xl text-sm leading-6 text-black/70`}>
				{props.description}
			</p>
		</div>
	)
}

export default function DesignSystemPage() {
	if (!isDesignSystemEnabled) {
		notFound()
	}

	return (
		<TooltipProvider delayDuration={150}>
			<main className="min-h-screen bg-canvas">
				<div className="border-b-3 border-neo-black bg-white px-6 py-4">
					<div className="flex items-center gap-6">
						<RadiantLogo />
						<Badge variant="mint">DESIGN SYSTEM</Badge>
					</div>
				</div>

				<PageHeader
					kicker="Internal catalog"
					title="Radiant UI"
					description="A living showcase of the project primitives, panel language, and dashboard building blocks. Use this page to validate the design system before reusing components in the real app."
					statuses={[
						{ label: "Radix", variant: "info" },
						{ label: "dnd-kit ready", variant: "success" },
						{ label: "Visual calendar V1", variant: "muted" },
					]}
				/>

				<div className="space-y-8 p-4 sm:p-6">
					<Panel title="Foundation" kicker="Brand and actions">
						<SectionTitle title="Buttons and badges" description="Core action and status primitives with semantic variants." />
						<div className="flex flex-wrap gap-3">
							<Button>Primary action</Button>
							<Button variant="secondary">Secondary</Button>
							<Button variant="ghost">Ghost</Button>
							<Button size="sm">Small</Button>
							<Button size="icon">+</Button>
						</div>
						<Separator className="my-6" />
						<div className="flex flex-wrap gap-3">
							<Badge variant="mint">Mint</Badge>
							<Badge variant="paper">Paper</Badge>
							<Badge variant="live">Live</Badge>
							<Badge variant="orange">Warm</Badge>
						</div>
					</Panel>

					<PanelGrid>
						<Panel title="Inputs" kicker="Forms" className="lg:col-span-6">
							<SectionTitle title="Field controls" description="Form controls that will be reused across dashboard configuration, scheduling, playlists, and media operations." />
							<div className="grid gap-4">
								<div className="space-y-2">
									<Label htmlFor="radio-name">Radio name</Label>
									<Input id="radio-name" placeholder="Radiant FM" />
								</div>
								<div className="space-y-2">
									<Label htmlFor="radio-description">Description</Label>
									<Textarea id="radio-description" placeholder="Night-time rotation with deterministic playout." />
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label>Timezone</Label>
										<Select defaultValue="lisbon">
											<SelectTrigger>
												<SelectValue placeholder="Choose timezone" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectLabel>Timezones</SelectLabel>
													<SelectItem value="lisbon">Europe/Lisbon</SelectItem>
													<SelectItem value="london">Europe/London</SelectItem>
												</SelectGroup>
												<SelectSeparator />
												<SelectGroup>
													<SelectItem value="tokyo">Asia/Tokyo</SelectItem>
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-end gap-6 pb-2">
										<div className="flex items-center gap-3">
											<Checkbox id="shuffle" defaultChecked />
											<Label htmlFor="shuffle">Shuffle deterministic</Label>
										</div>
										<div className="flex items-center gap-3">
											<Switch defaultChecked />
											<Label>Enable interruptions</Label>
										</div>
									</div>
								</div>
							</div>
						</Panel>

						<Panel title="Navigation" kicker="Switching views" className="lg:col-span-6">
							<SectionTitle title="Tabs and scroll areas" description="Layout primitives for dense application views and long content zones." />
							<Tabs defaultValue="overview">
								<TabsList>
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="calendar">Calendar</TabsTrigger>
									<TabsTrigger value="library">Library</TabsTrigger>
								</TabsList>
								<TabsContent value="overview">
									<ScrollArea className="mt-4 h-48 border-3 border-neo-black bg-surface-muted p-4 shadow-neo-badge">
										<div className="space-y-3">
											{Array.from({ length: 8 }).map((_, index) => (
												<Card key={index} className="bg-white px-3 py-3">
													<p className={`${groteskFont.className} text-sm font-bold tracking-tight text-neo-black`}>
														Scrollable event row {index + 1}
													</p>
												</Card>
											))}
										</div>
									</ScrollArea>
								</TabsContent>
								<TabsContent value="calendar">
									<EmptyState title="Calendar panel" description="The schedule editor will land here with custom lanes and block handles." />
								</TabsContent>
								<TabsContent value="library">
									<EmptyState title="Library panel" description="VFS browsing, uploads, and metadata panels will reuse the same shell." />
								</TabsContent>
							</Tabs>
						</Panel>
					</PanelGrid>

					<PanelGrid>
						<Panel title="Overlays" kicker="Menus and dialogs" className="lg:col-span-6">
							<SectionTitle title="Interactive surfaces" description="Radix-based building blocks for menus, contextual actions, and modal workflows." />
							<div className="flex flex-wrap gap-3">
								<Dialog>
									<DialogTrigger asChild>
										<Button variant="secondary">Open dialog</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>New interruption</DialogTitle>
											<DialogDescription>
												Dialog styling for operational actions and configuration flows.
											</DialogDescription>
										</DialogHeader>
										<div className="space-y-3">
											<Input placeholder="Emergency file name" />
										</div>
										<DialogFooter>
											<Button variant="secondary">Save draft</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="secondary">Open menu</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent>
										<DropdownMenuLabel>Playout actions</DropdownMenuLabel>
										<DropdownMenuItem>Open calendar</DropdownMenuItem>
										<DropdownMenuItem>Queue track next</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem>Interrupt stream</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								<Popover>
									<PopoverTrigger asChild>
										<Button variant="secondary">Open popover</Button>
									</PopoverTrigger>
									<PopoverContent>
										<p className={`${tomorrowFont.className} text-sm font-extrabold uppercase text-neo-black`}>Mini inspector</p>
										<p className={`${groteskFont.className} mt-2 text-sm leading-6 text-black/70`}>
											Use this for compact metadata, block info, and panel-specific tools.
										</p>
									</PopoverContent>
								</Popover>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="secondary">Hover me</Button>
									</TooltipTrigger>
									<TooltipContent>Broadcast console tooltip</TooltipContent>
								</Tooltip>
							</div>
						</Panel>

						<Panel title="Feedback" kicker="States" className="lg:col-span-6">
							<SectionTitle title="Loading, empty, and stat states" description="Feedback patterns for async panels, empty data, and compact metrics." />
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-3">
									<Skeleton className="h-12" />
									<Skeleton className="h-24" />
									<Skeleton className="h-10 w-1/2" />
								</div>
								<EmptyState title="No playlist selected" description="Pick a playlist from the library or create a new one to start programming this slot." />
							</div>
							<Separator className="my-6" />
							<div className="grid gap-4 sm:grid-cols-3">
								<StatCard label="Sync" accentClassName="bg-neo-mint">Locked</StatCard>
								<StatCard label="Listeners" accentClassName="bg-neo-paper">128</StatCard>
								<StatCard label="Warnings" accentClassName="bg-neo-orange">02</StatCard>
							</div>
						</Panel>
					</PanelGrid>

					<Panel title="Specialized Controls" kicker="Audio and transport">
						<SectionTitle title="Vertical slider" description="Audio-centric control for preview volume, mixer strips, or other level-based tooling." />
						<div className="flex items-end gap-8">
							<VerticalSlider value={72} onChange={() => {}} label="Preview volume" />
							<VerticalSlider value={40} onChange={() => {}} label="Jingle volume" className="bg-surface" />
							<div className="space-y-2">
								<StatusPill variant="success">Preview locked</StatusPill>
								<StatusPill variant="live">On air</StatusPill>
								<StatusPill variant="info">Visual only</StatusPill>
							</div>
						</div>
					</Panel>

					<div className="space-y-8">
						<SectionTitle title="Dashboard Building Blocks" description="These are the real product panels that the overview dashboard is already built from." />
						<PanelGrid>
							<div className="lg:col-span-8">
								<PreviewCard
									cover={matsuriCover}
									coverAlt="Matsuri cover art"
									title="Matsuri"
									artist="Fujii Kaze"
									playlistName="Sunset Rotation / Festival Cuts"
									endsAt="18:24"
									nextTrackLabel="Lamp - 恋人へ / Koibito e"
									defaultVolume={72}
									defaultMuted={false}
									isLive
								/>
							</div>
							<HealthPanel />
							<ScheduleMiniPanel />
							<UpcomingPanel />
							<LibrarySnapshotPanel />
							<QuickActionsPanel />
						</PanelGrid>
					</div>
				</div>
			</main>
		</TooltipProvider>
	)
}
