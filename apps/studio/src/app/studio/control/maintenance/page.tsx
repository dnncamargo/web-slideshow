import type { Metadata } from "next";
import { MaintenancePage } from "@/features/control/maintenance-page";

export const metadata: Metadata = { title: "PowerShow Maintenance" };
export default function StudioControlMaintenancePage() { return <MaintenancePage />; }
