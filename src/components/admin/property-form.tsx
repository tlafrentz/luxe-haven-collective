"use client";

import { useActionState, useMemo } from "react";
import type { ChangeEvent } from "react";
import type { Property, PropertyMedia } from "@/types/database";

import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/actions/properties";
import { MediaManager } from "@/components/admin/property-editor/media-manager";
import {
  EditorShell,
  SectionCard,
} from "@/components/admin/property-editor";
import { usePropertyStudio } from "@/components/admin/property-studio";
import type { PropertyFormState } from "@/components/admin/property-editor/types";

import { AmenitiesSection } from "@/components/admin/property-editor/sections/amenities";
import { LocationSection } from "@/components/admin/property-editor/sections/location";
import { OverviewSection } from "@/components/admin/property-editor/sections/overview";
import { PricingSection } from "@/components/admin/property-editor/sections/pricing";
import { PublishingSection } from "@/components/admin/property-editor/sections/publishing";
import { RulesSection } from "@/components/admin/property-editor/sections/rules";
import { SeoSection } from "@/components/admin/property-editor/sections/seo";

const initialState: PropertyFormState = {
  ok: false,
  message: "",
};

const blank: Partial<Property> = {
  name: "",
  slug: "",
  headline: "",
  short_description: "",
  description: "",
  property_type: "home",

  address_line_1: "",
  address_line_2: "",
  neighborhood: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",

  bedrooms: 2,
  bathrooms: 2,
  beds: 2,
  max_guests: 4,

  nightly_rate: 200,
  cleaning_fee: 150,
  security_deposit: 0,
  service_fee: 0,
  tax_rate: 0.12,
  minimum_nights: 2,

  check_in_time: "4:00 PM",
  check_out_time: "10:00 AM",

  status: "draft",
  amenities: [],
  highlights: [],
  house_rules: [],

  featured_image_url: "",
  image_urls: [],

  seo_title: "",
  seo_description: "",
  is_featured: false,
};

const numberFields = new Set([
  "bedrooms",
  "bathrooms",
  "beds",
  "max_guests",
  "nightly_rate",
  "cleaning_fee",
  "security_deposit",
  "service_fee",
  "tax_rate",
  "minimum_nights",
]);

const listFields = new Set([
  "amenities",
  "highlights",
  "house_rules",
  "image_urls",
]);

function parseDraftValue(name: string, value: string) {
  if (numberFields.has(name)) {
    return Number(value || 0);
  }

  if (listFields.has(name)) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (name === "is_featured") {
    return value === "true";
  }

  return value;
}

export function PropertyForm({
  property,
  media = [],
}: {
  property?: Property;
  media?: PropertyMedia[];
}) {
  const { updateDraft } = usePropertyStudio();

  const action = property
    ? updatePropertyAction.bind(null, property.id)
    : createPropertyAction;

  const [state, formAction] = useActionState(action, initialState);

  const values = useMemo<
    Partial<Property> & Record<string, unknown>
  >(
    () => ({
      ...blank,
      ...property,
      status: property?.status ?? "draft",
    }),
    [property],
  );

  function handleFormChange(event: ChangeEvent<HTMLFormElement>) {
    const target = event.target;

    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    if (!target.name) {
      return;
    }

    updateDraft(
      target.name,
      parseDraftValue(target.name, target.value),
    );
  }

  return (
    <div>
      <form
        id="property-editor-form"
        action={formAction}
        onChange={handleFormChange}
      >
        <EditorShell
          title={
            property
              ? `Edit ${property.name}`
              : "Create property"
          }
          status={String(values.status)}
          description="Manage listing content, pricing, amenities, publishing status, and marketing details for this Luxe Haven property."
        >
          {state.message ? (
            <div className="mb-6 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-8">
            <SectionCard
              id="overview"
              title="Overview"
              description="Core marketing information guests and owners will see first."
            >
              <OverviewSection
                values={values}
                state={state}
              />
            </SectionCard>

            <SectionCard
              id="location"
              title="Location"
              description="Address, neighborhood, and market information for this property."
            >
              <LocationSection values={values} />
            </SectionCard>

            <SectionCard
              id="pricing"
              title="Pricing & stay rules"
              description="Base rates, fees, occupancy, and check-in expectations."
            >
              <PricingSection values={values} />
            </SectionCard>

            <SectionCard
              id="amenities"
              title="Amenities & highlights"
              description="Use one item per line. These will appear on public property pages."
            >
              <AmenitiesSection values={values} />
            </SectionCard>

            <SectionCard
              id="rules"
              title="House rules"
              description="Guest-facing policies and expectations."
            >
              <RulesSection values={values} />
            </SectionCard>

            <SectionCard
              id="seo"
              title="SEO"
              description="Search and social metadata for the public property page."
            >
              <SeoSection values={values} />
            </SectionCard>

            <SectionCard
              id="publishing"
              title="Publishing"
              description="Control whether this property appears on the Luxe Haven website."
            >
              <PublishingSection values={values} />
            </SectionCard>
          </div>
        </EditorShell>
      </form>

      <div className="mt-8 lg:ml-[284px]">
        <SectionCard
          id="photos"
          title="Photos"
          description="Upload, organize, and feature property images."
        >
          {property?.id ? (
            <MediaManager
              propertyId={property.id}
              media={media}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/55">
              Save the property before uploading images.
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
