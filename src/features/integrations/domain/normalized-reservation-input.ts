export type NormalizedReservationInput = Readonly<{
  externalId: string;
  propertyId: string;
  externalPropertyId: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  nightlyRate: number;
  cleaningFee: number;
  taxes: number;
  serviceFee: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  paymentStatus: "unpaid" | "authorized" | "paid" | "refunded" | "failed";
  source: string;
  currency: string | null;
}>;
