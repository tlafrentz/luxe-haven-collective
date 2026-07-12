import type {
  HospitablePropertiesResponse,
  HospitableProperty,
} from "../types";

import { hospitableRequest } from "./client";

export async function getHospitableProperties({
  page = 1,
}: {
  page?: number;
} = {}): Promise<HospitablePropertiesResponse> {
  return hospitableRequest<HospitablePropertiesResponse>(
    "/properties",
    {
      searchParams: {
        page,
      },
    },
  );
}

export async function getAllHospitableProperties(): Promise<
  HospitableProperty[]
> {
  const properties: HospitableProperty[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await getHospitableProperties({
      page,
    });

    properties.push(...response.data);

    const currentPage =
      response.meta.current_page ?? page;

    const lastPage =
      response.meta.last_page ?? currentPage;

    hasNextPage =
      Boolean(response.links.next) ||
      currentPage < lastPage;

    page += 1;
  }

  return properties;
}
