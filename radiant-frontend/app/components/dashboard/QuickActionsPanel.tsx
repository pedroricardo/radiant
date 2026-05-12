import { Button } from "../ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/Dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/DropdownMenu"
import { Input } from "../ui/Input"
import { Label } from "../ui/label"
import { Panel } from "./Panel"

export function QuickActionsPanel() {
	return (
		<Panel title="Quick Actions" kicker="Operator tools" className="lg:col-span-4">
			<div className="flex flex-wrap gap-3">
				<Dialog>
					<DialogTrigger asChild>
						<Button variant="secondary">Add interruption</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Interrupt transmission</DialogTitle>
							<DialogDescription>
								Prepare the manual interruption flow. The actual audio selection will be wired later.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							<div className="space-y-2">
								<Label>Reason</Label>
								<Input placeholder="Emergency file / station ID / sponsor break" />
							</div>
						</div>
						<DialogFooter>
							<Button variant="secondary">Save draft</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary">Open tool menu</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem>Open calendar</DropdownMenuItem>
						<DropdownMenuItem>Open VFS</DropdownMenuItem>
						<DropdownMenuItem>Rotate studio token</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</Panel>
	)
}
