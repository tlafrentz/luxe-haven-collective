"use client";
import{usePathname}from"next/navigation";import{WorkspaceNavigation}from"@/components/application-layout";
const items=[{label:"Overview",href:"/dashboard/understand"},{label:"Business Health",href:"/dashboard/understand/health"},{label:"Performance",href:"/dashboard/understand/performance"},{label:"Risks",href:"/dashboard/understand/risks"},{label:"Decisions",href:"/dashboard/understand/actions"},{label:"Learning",href:"/dashboard/understand/outcomes"}]as const;
export default function ExecutiveIntelligenceLayout({children}:{children:React.ReactNode}){const pathname=usePathname(),active=items.find(item=>pathname===item.href)?.href??"/dashboard/understand";return <><WorkspaceNavigation label="Executive Intelligence workspace" items={items} activeHref={active}/>{children}</>}
