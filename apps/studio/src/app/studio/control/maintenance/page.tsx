import type { Metadata } from "next";
import { displayName } from "@web-slideshow/instance-branding";
import { MaintenancePage } from "@/features/control/maintenance-page";

export const metadata: Metadata = { title: `${displayName} Maintenance` };
export default function StudioControlMaintenancePage() { return <MaintenancePage />; }
