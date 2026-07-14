"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

type DashboardShellProps = {
  children: ReactNode
}

type NavigationItem = {
  label: string
  href?: string
  abbreviation: string
  comingSoon?: boolean
}

const navigationItems: NavigationItem[] = [
{
  label: "Revenue Intelligence",
  href: "/dashboard/insights",
  abbreviation: "RI",
},
  {
    label: "Luxe Insights",
    href: "/dashboard/insights",
    abbreviation: "LI",
  },
  {
    label: "Properties",
    abbreviation: "PR",
    comingSoon: true,
  },
  {
    label: "Bookings",
    abbreviation: "BK",
    comingSoon: true,
  },
  {
    label: "Messages",
    abbreviation: "MS",
    comingSoon: true,
  },
  {
    label: "Reports",
    abbreviation: "RP",
    comingSoon: true,
  },
]

function isNavigationItemActive(
  pathname: string,
  href?: string,
) {
  if (!href) {
    return false
  }

  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav
      aria-label="Dashboard navigation"
      className="space-y-1"
    >
      {navigationItems.map((item) => {
        const active = isNavigationItemActive(
          pathname,
          item.href,
        )

        if (!item.href || item.comingSoon) {
          return (
            <div
              key={item.label}
              className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-sm text-stone-500"
              aria-disabled="true"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-semibold tracking-wide text-stone-500">
                  {item.abbreviation}
                </span>

                {item.label}
              </span>

              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                Soon
              </span>
            </div>
          )
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-white text-stone-950 shadow-sm"
                : "text-stone-400 hover:bg-white/[0.06] hover:text-white",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-semibold tracking-wide",
                active
                  ? "bg-stone-950 text-white"
                  : "border border-white/10 bg-white/[0.04] text-stone-400",
              ].join(" ")}
            >
              {item.abbreviation}
            </span>

            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-stone-950 text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="block"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Luxe Haven
          </p>

          <p className="mt-1 text-lg font-semibold">
            Collective
          </p>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-600">
          Workspace
        </p>

        <Navigation
          pathname={pathname}
          onNavigate={onNavigate}
        />

        <div className="my-6 border-t border-white/10" />

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-600">
          Management
        </p>

        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-semibold tracking-wide">
            AD
          </span>

          Admin Console
        </Link>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-2xl bg-white/[0.05] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-950">
              TL
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Todd L
              </p>

              <p className="truncate text-xs text-stone-500">
                Administrator
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            className="mt-4 block rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-semibold text-stone-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            Account settings
          </Link>
        </div>
      </div>
    </div>
  )
}

function getPageDetails(pathname: string) {
  if (pathname.startsWith("/dashboard/insights")) {
    return {
      eyebrow: "Performance intelligence",
      title: "Luxe Insights",
    }
  }

  if (pathname.startsWith("/dashboard/properties")) {
    return {
      eyebrow: "Portfolio management",
      title: "Properties",
    }
  }

  if (pathname.startsWith("/dashboard/bookings")) {
    return {
      eyebrow: "Reservation management",
      title: "Bookings",
    }
  }
return {
  eyebrow: "Executive intelligence",
  title: "Command Center",
}
}

export function DashboardShell({
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false)

  const pageDetails = getPageDetails(pathname)

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = ""
      return
    }

    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative h-full w-[86%] max-w-80 shadow-2xl">
            <Sidebar
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#f8f7f4]/90 backdrop-blur-xl">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-950 shadow-sm lg:hidden"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <span className="space-y-1">
                  <span className="block h-0.5 w-4 bg-current" />
                  <span className="block h-0.5 w-4 bg-current" />
                  <span className="block h-0.5 w-4 bg-current" />
                </span>
              </button>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                  {pageDetails.eyebrow}
                </p>

                <p className="truncate text-lg font-semibold text-stone-950">
                  {pageDetails.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="hidden min-w-56 items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left text-sm text-stone-500 shadow-sm transition hover:border-stone-300 sm:flex"
              >
                <span>Search workspace</span>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-500">
                  ⌘ K
                </span>
              </button>

              <button
                type="button"
                aria-label="View notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300"
              >
                N
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">
                TL
              </div>
            </div>
          </div>
        </header>

        <div>{children}</div>
      </div>
    </div>
  )
}
