"use client";

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

const INPUT_CLASS_NAME =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200";

function parseNumber(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function PropertyProfileCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

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

              <input
                type="number"
                min="0"
                value={values.bedrooms}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    bedrooms:
                      parseNumber(
                        event.target.value,
                      ),
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-500">
                Bathrooms
              </span>

              <input
                type="number"
                min="0"
                step="0.5"
                value={values.bathrooms}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    bathrooms:
                      parseNumber(
                        event.target.value,
                      ),
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
            </label>

            <label className="sm:col-span-2">
              <span className="text-xs font-medium text-neutral-500">
                Square feet
              </span>

              <input
                type="number"
                min="0"
                value={values.squareFeet}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    squareFeet:
                      parseNumber(
                        event.target.value,
                      ),
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
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

              <input
                type="number"
                min="0"
                value={values.purchasePrice}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    purchasePrice:
                      parseNumber(
                        event.target.value,
                      ),
                  }))
                }
                className={INPUT_CLASS_NAME}
              />
              <span className="mt-1.5 block text-xs text-neutral-500">Source: User supplied. Market value is shown separately.</span>
            </label>
          </section>
        ) : null}
      </div>
    </AcquisitionSectionCard>
  );
}
