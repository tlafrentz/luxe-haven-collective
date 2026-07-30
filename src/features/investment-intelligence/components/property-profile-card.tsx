"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncInvestmentPropertyAction } from "@/app/actions/investment-property-sync";
import {
  AcquisitionType,
  PropertyType,
} from "../domain";

import {
  AcquisitionSectionCard,
} from "./acquisition-section-card";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

import { INVESTMENT_NUMERIC_ASSUMPTION_POLICIES } from "../application/assumptions";
import { InvestmentNumericInput } from "./investment-numeric-input";
import { AssumptionFieldGuidance } from "./assumption-field-guidance";

const INPUT_CLASS_NAME =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200";

export function PropertyProfileCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncPending, startSync] = useTransition();

  const isPurchase =
    values.acquisitionType ===
    AcquisitionType.Purchase;

  return (
    <AcquisitionSectionCard
      eyebrow="Property"
      title="Define the acquisition opportunity."
      description="Capture the location, physical profile, and acquisition basis that shape the investment case."
      icon={
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9 21v-6h6v6" />
        </svg>
      }
    >
      <div className="space-y-7">
        <section
          aria-labelledby="property-location-heading"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4
                id="property-location-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Location
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Identify the property and market being underwritten.
              </p>
            </div>
            <button
              type="button"
              disabled={syncPending || !values.address1.trim()}
              onClick={() => startSync(async () => {
                setSyncMessage(null);
                const address = [values.address1, values.city, values.state, values.postalCode].filter(Boolean).join(", ");
                const result = await syncInvestmentPropertyAction({ address });
                if (!result.ok) {
                  setSyncMessage({ type: "error", text: result.message });
                  return;
                }
                const propertyType = toPropertyType(result.data.propertyType);
                setValues(current => ({
                  ...current,
                  ...(result.data.address1 ? { address1: result.data.address1 } : {}),
                  ...(result.data.city ? { city: result.data.city } : {}),
                  ...(result.data.state ? { state: result.data.state } : {}),
                  ...(result.data.postalCode ? { postalCode: result.data.postalCode } : {}),
                  ...(propertyType ? { propertyType } : {}),
                  ...(result.data.bedrooms !== undefined ? { bedrooms: result.data.bedrooms } : {}),
                  ...(result.data.bathrooms !== undefined ? { bathrooms: result.data.bathrooms } : {}),
                  ...(result.data.squareFeet !== undefined ? { squareFeet: result.data.squareFeet } : {}),
                  ...(result.data.purchasePrice !== undefined ? { purchasePrice: result.data.purchasePrice } : {}),
                  ...(result.data.projectedAdr !== undefined ? { projectedAdr: result.data.projectedAdr } : {}),
                  ...(result.data.projectedOccupancyPercentage !== undefined ? { projectedOccupancyPercentage: result.data.projectedOccupancyPercentage } : {}),
                }));
                const text = result.status === "coordinates-missing"
                  ? "Property synced, but coordinates were unavailable. STR market enrichment could not run; manual analysis remains available."
                  : result.status === "str-unavailable"
                    ? "Property synced from RealtyAPI, but STR market data was unavailable. Manual assumptions were preserved."
                    : result.status === "str-limited"
                      ? "Property and STR market data synced with limited comparable evidence. Review the evidence limitations before relying on provider estimates."
                      : "Property and STR market data synced successfully.";
                setSyncMessage({ type: "success", text });
              })}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncPending ? "animate-spin" : ""}`} />
              {syncPending ? "Syncing…" : "Sync property data"}
            </button>
          </div>
          {syncMessage ? <p role={syncMessage.type === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-xs ${syncMessage.type === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{syncMessage.text}</p> : null}

          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-neutral-500">
                Street address
              </span>

              <input
                value={values.address1}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    address1:
                      event.target.value,
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-500">
                City
              </span>

              <input
                value={values.city}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="text-xs font-medium text-neutral-500">
                  State
                </span>

                <input
                  value={values.state}
                  maxLength={2}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      state:
                        event.target.value
                          .toUpperCase(),
                    }))
                  }
                  className={INPUT_CLASS_NAME}
                />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Postal code
                </span>

                <input
                  value={values.postalCode}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      postalCode:
                        event.target.value,
                    }))
                  }
                  className={INPUT_CLASS_NAME}
                />
              </label>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="property-specifications-heading"
          className="border-t border-neutral-200 pt-6"
        >
          <div>
            <h4
              id="property-specifications-heading"
              className="text-sm font-semibold text-neutral-950"
            >
              Property specifications
            </h4>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Define the physical characteristics used in the operating case.
            </p>
          </div>

          <div className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-neutral-500">
                Property type
              </span>

              <select
                value={values.propertyType}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    propertyType:
                      event.target
                        .value as PropertyType,
                  }))
                }
                className={INPUT_CLASS_NAME}
              >
                {Object.values(
                  PropertyType,
                ).map((propertyType) => (
                  <option
                    key={propertyType}
                    value={propertyType}
                  >
                    {propertyType
                      .split("-")
                      .map(
                        (word) =>
                          word
                            .charAt(0)
                            .toUpperCase() +
                          word.slice(1),
                      )
                      .join(" ")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-500">
                Bedrooms
              </span>

              <InvestmentNumericInput value={values.bedrooms} onCommit={(value) => setValues((current) => ({ ...current, bedrooms: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.bedrooms} label="bedrooms" className={INPUT_CLASS_NAME} />
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-500">
                Bathrooms
              </span>

              <InvestmentNumericInput value={values.bathrooms} onCommit={(value) => setValues((current) => ({ ...current, bathrooms: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.bathrooms} label="bathrooms" className={INPUT_CLASS_NAME} />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-neutral-500">
                Square feet
              </span>

              <InvestmentNumericInput value={values.squareFeet} onCommit={(value) => setValues((current) => ({ ...current, squareFeet: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.squareFeet} label="squareFeet" className={INPUT_CLASS_NAME} />
            </label>
          </div>
        </section>

        {isPurchase ? (
          <section
            aria-labelledby="property-acquisition-heading"
            className="border-t border-neutral-200 pt-6"
          >
            <div>
              <h4
                id="property-acquisition-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Acquisition basis
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Set the proposed purchase price used by the purchase
                underwriting model.
              </p>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-medium text-neutral-500">
                Purchase price
              </span>

              <InvestmentNumericInput value={values.purchasePrice} onCommit={(value) => setValues((current) => ({ ...current, purchasePrice: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.purchasePrice} label="purchasePrice" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="purchasePrice" />
              <span className="mt-1.5 block text-xs text-neutral-500">Source: User supplied. Market value is shown separately.</span>
            </label>
          </section>
        ) : null}
      </div>
    </AcquisitionSectionCard>
  );
}

function toPropertyType(value?: string): PropertyType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[_\s]+/g, "-");
  if (Object.values(PropertyType).includes(normalized as PropertyType)) return normalized as PropertyType;
  if (normalized.includes("single") || normalized === "house") return PropertyType.SingleFamily;
  if (normalized.includes("multi")) return PropertyType.MultiFamily;
  if (normalized.includes("town")) return PropertyType.Townhome;
  if (normalized.includes("condo")) return PropertyType.Condo;
  if (normalized.includes("cabin")) return PropertyType.Cabin;
  if (normalized.includes("apartment")) return PropertyType.Apartment;
  return undefined;
}
