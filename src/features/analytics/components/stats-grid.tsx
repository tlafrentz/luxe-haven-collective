import {
  BedDouble,
  CalendarDays,
  DollarSign,
  Gauge,
} from "lucide-react";

import {
  formatCurrency,
  formatPercentage,
} from "../lib";
import type {
  DashboardComparison,
  DashboardMetrics,
} from "../types";

import { StatCard } from "./stat-card";

type StatsGridProps = {
  metrics: DashboardMetrics;
  comparison: DashboardComparison;
};

export function StatsGrid({
  metrics,
  comparison,
}: StatsGridProps) {
  return (
    <section
      aria-label="Property performance metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
<StatCard
  title="Gross Revenue"
  value={formatCurrency(metrics.grossRevenue)}
  description={`${metrics.totalBookings} revenue-producing bookings`}
  trend={comparison.revenue}
  accent="emerald"
  icon={
    <DollarSign
      aria-hidden="true"
      className="h-5 w-5"
    />
  }
/>

<StatCard
  title="Occupancy"
  value={formatPercentage(metrics.occupancyRate)}
  description={`${metrics.occupiedNights} of ${metrics.availableNights} available nights`}
  trend={comparison.occupancy}
  accent="blue"
  icon={
    <CalendarDays
      aria-hidden="true"
      className="h-5 w-5"
    />
  }
/>

<StatCard
  title="Average Daily Rate"
  value={formatCurrency(metrics.averageDailyRate)}
  description="Average room revenue per occupied night"
  trend={comparison.adr}
  accent="amber"
  icon={
    <BedDouble
      aria-hidden="true"
      className="h-5 w-5"
    />
  }
/>

      <StatCard
        title="RevPAR"
        value={formatCurrency(metrics.revPar)}
        description="Room revenue per available night"
        trend={comparison.revPar}
        accent="violet"
        icon={
          <Gauge
            aria-hidden="true"
            className="h-5 w-5"
          />
        }
      />
    </section>
  );
}
