import {
  differenceInNights,
  formatCurrency,
  formatDate,
} from "../lib";
import type { AnalyticsBooking } from "../types";

import { StatusBadge } from "./status-badge";

type BookingsTableProps = {
  bookings: AnalyticsBooking[];
};

export function BookingsTable({
  bookings,
}: BookingsTableProps) {
  const sortedBookings = [...bookings].sort(
    (first, second) =>
      first.checkIn.localeCompare(second.checkIn),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <p className="text-sm font-medium text-neutral-500">
          Reservation activity
        </p>

        <h2 className="mt-1 text-xl font-semibold text-neutral-950">
          Bookings in selected period
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Reservations that overlap the current reporting dates.
        </p>
      </div>

      {sortedBookings.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <h3 className="text-sm font-semibold text-neutral-950">
            No bookings found
          </h3>

          <p className="mt-2 text-sm text-neutral-500">
            Adjust the property or date filters to view reservation
            activity.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <TableHeading>Guest</TableHeading>
                <TableHeading>Check-in</TableHeading>
                <TableHeading>Nights</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Payment</TableHeading>
                <TableHeading>Source</TableHeading>
                <TableHeading align="right">Total</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 bg-white">
              {sortedBookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="transition hover:bg-neutral-50"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-neutral-950">
                        {booking.guestFullName ?? "Guest"}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        {booking.guests}{" "}
                        {booking.guests === 1 ? "guest" : "guests"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    {formatDate(booking.checkIn)}
                  </TableCell>

                  <TableCell>
                    {differenceInNights(
                      booking.checkIn,
                      booking.checkOut,
                    )}
                  </TableCell>

                  <TableCell>
                    <StatusBadge value={booking.status} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge
                      value={booking.paymentStatus}
                      type="payment"
                    />
                  </TableCell>

                  <TableCell>
                    {booking.source ?? "Direct"}
                  </TableCell>

                  <TableCell align="right">
                    <span className="font-medium text-neutral-950">
                      {formatCurrency(booking.totalAmount)}
                    </span>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`whitespace-nowrap px-5 py-4 text-sm text-neutral-600 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}
