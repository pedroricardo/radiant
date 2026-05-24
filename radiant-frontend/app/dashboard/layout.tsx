import type { ReactNode } from "react"

import { DashboardSidebar } from "../components/dashboard/DashboardSidebar"
import { DashboardShell } from "../components/dashboard/DashboardShell"
import { requireCurrentUser } from "../lib/auth"

type DashboardLayoutProps = Readonly<{
	children: ReactNode
}>

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
	await requireCurrentUser()

	return children
}
