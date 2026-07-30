import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mapRealtyApiCandidates, mapRealtyApiProperty } from "./mapper";
import type { RealtyApiAutocompleteResponseDto, RealtyApiPropertyResponseDto } from "./types";

const candidate = {
  providerPropertyId: "987654321",
  listingId: "listing-22",
  formattedAddress: "650 S Main St, Fort Worth, TX 76104",
} as const;
const context = {
  subjectPropertyId: "subject-property-1",
  snapshotId: "property-snapshot-1",
  snapshotVersion: 1,
  retrievedAt: new Date("2026-07-29T12:00:00.000Z"),
  requestedAddressKey: "650 s main st fort worth tx 76104",
} as const;

describe("RealtyAPI canonical mapper", () => {
  it("maps autocomplete records without leaking DTO fields", () => {
    expect(mapRealtyApiCandidates({ data: { suggestions: [
      { property_id: 987654321, listing_id: "listing-22", display_name: candidate.formattedAddress, centroid: { lat: 32.72, lon: -97.33 } },
      { display_name: "Fort Worth, TX" },
    ] } })).toEqual([{ ...candidate, latitude: 32.72, longitude: -97.33 }]);
  });

  it("maps the current RealtyAPI searchResults autocomplete envelope", () => {
    expect(mapRealtyApiCandidates({ searchResults: [
      { id: 987654321, display_name: candidate.formattedAddress, centroid: { lat: 32.72, lon: -97.33 } },
    ] })).toEqual([{
      providerPropertyId: "987654321",
      formattedAddress: candidate.formattedAddress,
      latitude: 32.72,
      longitude: -97.33,
    }]);
  });

  it("maps only address candidates from the sanitized live Bideker envelope", () => {
    const response = JSON.parse(readFileSync(
      resolve(process.cwd(), "src/features/market-intelligence/infrastructure/realtyapi/fixtures/3108-bideker-ave.autocomplete.json"),
      "utf8",
    )) as RealtyApiAutocompleteResponseDto;

    expect(mapRealtyApiCandidates(response)).toEqual([
      {
        providerPropertyId: "7039944051",
        formattedAddress: "3108 Bideker Ave, Fort Worth, TX 76105",
        latitude: 32.718749,
        longitude: -97.280627,
      },
      {
        providerPropertyId: "7967975892",
        formattedAddress: "3108 Avenue H, Fort Worth, TX 76105",
      },
      {
        providerPropertyId: "8667666707",
        formattedAddress: "3108 Avenue M, Fort Worth, TX 76105",
      },
      {
        providerPropertyId: "7348510365",
        formattedAddress: "3108 Avenue N, Fort Worth, TX 76105",
      },
    ]);
  });

  it("maps nested property details, lineage on every field, and partial data gaps", () => {
    const property = mapRealtyApiProperty({ data: { home: {
      property_id: "987654321",
      address: { formatted_address: candidate.formattedAddress, line: "650 S Main St", city: "Fort Worth", state_code: "TX", postal_code: "76104", county: "Tarrant" },
      location: { latitude: 32.72, longitude: -97.33 },
      description: { type: "single_family", beds: 3, baths: 2, sqft: 1810, year_built: 1925 },
      status: "for_sale", list_price: 425000, last_sold_price: 300000, last_sold_date: "2020-02-01",
    } } }, candidate, context);

    expect(property).toMatchObject({
      id: "subject-property-1",
      provider: "realtyapi",
      providerPropertyId: "987654321",
      snapshotId: "property-snapshot-1",
      snapshotVersion: 1,
      physical: { bedrooms: { value: 3 }, bathrooms: { value: 2 } },
      listing: { listPrice: { value: 425000 } },
    });
    expect(property.address.street.lineage).toMatchObject({
      provider: "realtyapi",
      snapshotId: "property-snapshot-1",
      sourceEndpoint: "/details/byid",
    });
    expect(property.missingFields).toContain("physical.lotSizeSquareFeet");
    expect(property.confidence.completeness).toBeGreaterThan(80);
    expect(Object.isFrozen(property)).toBe(true);
  });

  it("maps the sanitized known-successful RealtyAPI response", () => {
    const response = JSON.parse(readFileSync(
      resolve(process.cwd(), "src/features/market-intelligence/infrastructure/realtyapi/fixtures/7825-gaston-ave.property.json"),
      "utf8",
    )) as RealtyApiPropertyResponseDto;
    const property = mapRealtyApiProperty(response, {
      providerPropertyId: "8814016880",
      listingId: "2998950893",
      formattedAddress: "7825 Gaston Ave, Fort Worth, TX 76116",
    }, {
      ...context,
      requestedAddressKey: "7825 gaston ave fort worth tx 76116",
    });

    expect(property).toMatchObject({
      providerPropertyId: "8814016880",
      address: {
        street: { value: "7825 Gaston Ave" },
        city: { value: "Fort Worth" },
        state: { value: "TX" },
        postalCode: { value: "76116" },
        latitude: { value: 32.710249 },
        longitude: { value: -97.451834 },
      },
      physical: {
        propertyType: { value: "single_family" },
        bedrooms: { value: 3 },
        bathrooms: { value: 2 },
        livingAreaSquareFeet: { value: 1194 },
        lotSizeSquareFeet: { value: 9801 },
        yearBuilt: { value: 1958 },
      },
      listing: { status: { value: "for_sale" }, listPrice: { value: 185000 } },
    });
    expect(property.missingFields).not.toContain("address.latitude");
    expect(property.missingFields).not.toContain("address.longitude");
    expect(property.missingFields).not.toContain("physical.yearBuilt");
  });

  it("maps the proven Bideker property-detail fields", () => {
    const property = mapRealtyApiProperty({
      message: "Success",
      detail: {
        property_id: "7039944051",
        listing_id: "2998917610",
        status: "for_sale",
        list_price: 219000,
        details: { type: "single_family", beds: 4, baths: "2", sqft: 1320, lot_sqft: 7013, year_built: 1935 },
        address: {
          line: "3108 Bideker Ave",
          city: "Fort Worth",
          state_code: "TX",
          postal_code: "76105",
          latitude: 32.718749,
          longitude: -97.280627,
        },
      },
    }, {
      providerPropertyId: "7039944051",
      formattedAddress: "3108 Bideker Ave, Fort Worth, TX 76105",
    }, {
      ...context,
      requestedAddressKey: "3108 bideker ave fort worth tx 76105",
    });

    expect(property).toMatchObject({
      providerPropertyId: "7039944051",
      address: {
        street: { value: "3108 Bideker Ave" },
        city: { value: "Fort Worth" },
        state: { value: "TX" },
        postalCode: { value: "76105" },
      },
      physical: {
        bedrooms: { value: 4 },
        bathrooms: { value: 2 },
        livingAreaSquareFeet: { value: 1320 },
        yearBuilt: { value: 1935 },
      },
      listing: { status: { value: "for_sale" }, listPrice: { value: 219000 } },
    });
  });
});
