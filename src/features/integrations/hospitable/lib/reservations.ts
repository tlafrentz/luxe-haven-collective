import type {
  HospitableReservation,
  HospitableReservationDetailResponse,
  HospitableReservationsResponse,
} from "../types";

import { hospitableRequest } from "./client";

export type HospitableReservationQuery = {
  propertyIds: string[];
  startDate: string;
  endDate: string;
  page?: number;
};

function buildReservationSearchParams({
  propertyIds,
  startDate,
  endDate,
  page = 1,
}: HospitableReservationQuery): Record<
  string,
  string | number | boolean | undefined
> {
  if (propertyIds.length === 0) {
    throw new Error(
      "At least one Hospitable property ID is required.",
    );
  }

  const searchParams: Record<
    string,
    string | number | boolean | undefined
  > = {
    start_date: startDate,
    end_date: endDate,
    page,
  };

  propertyIds.forEach((propertyId, index) => {
    searchParams[`properties[${index}]`] =
      propertyId;
  });

  return searchParams;
}

export async function getHospitableReservations(
  query: HospitableReservationQuery,
): Promise<HospitableReservationsResponse> {
  return hospitableRequest<HospitableReservationsResponse>(
    "/reservations",
    {
      searchParams:
        buildReservationSearchParams(query),
    },
  );
}

export async function getAllHospitableReservations({
  propertyIds,
  startDate,
  endDate,
}: Omit<
  HospitableReservationQuery,
  "page"
>): Promise<HospitableReservation[]> {
  const reservations: HospitableReservation[] = [];

  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response =
      await getHospitableReservations({
        propertyIds,
        startDate,
        endDate,
        page,
      });

    reservations.push(...response.data);

    const currentPage =
      response.meta.current_page ?? page;

    const lastPage =
      response.meta.last_page ?? currentPage;

    hasNextPage =
      Boolean(response.links.next) ||
      currentPage < lastPage;

    page += 1;
  }

  return reservations;
}

export async function getHospitableReservationDetail(
  reservationId: string,
): Promise<HospitableReservation> {
  const response =
    await hospitableRequest<HospitableReservationDetailResponse>(
      `/reservations/${reservationId}`,
      {
        searchParams: {
          include:
            "guest,financials,listings,properties",
        },
      },
    );

  return response.data;
}
