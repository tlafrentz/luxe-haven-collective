"use client";

import { useActionState, useMemo } from "react";
import type { Property } from "@/types/database";
import { Button } from "@/components/ui/button";
import { createPropertyAction, updatePropertyAction } from "@/app/actions/properties";

type State = { ok: boolean; message: string; errors?: Record<string, string[]> };
const initialState: State = { ok: false, message: "" };

const blank = {
  name: "", slug: "", headline: "", short_description: "", description: "", property_type: "home", address: "", neighborhood: "", city: "", state: "",
  bedrooms: 2, bathrooms: 2, max_guests: 4, nightly_rate: 200, cleaning_fee: 150, service_fee: 0, tax_rate: 0.12, minimum_nights: 2,
  check_in_time: "4:00 PM", check_out_time: "10:00 AM", status: "draft", amenities: [], highlights: [], house_rules: [], featured_image: "", images: [], seo_title: "", seo_description: ""
};

function lines(value?: string[] | null) { return (value ?? []).join("\n"); }
function FieldError({ message }: { message?: string[] }) { return message?.[0] ? <p className="mt-1 text-xs text-red-300">{message[0]}</p> : null; }

export function PropertyForm({ property }: { property?: Property }) {
  const action = property ? updatePropertyAction.bind(null, property.id) : createPropertyAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = useMemo(() => ({ ...blank, ...property }), [property]);

  return (
    <form action={formAction} className="grid gap-8">
      {state.message ? <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">{state.message}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="font-serif text-3xl">Core details</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm">Name<input name="name" defaultValue={values.name} className="input-dark" /><FieldError message={state.errors?.name} /></label>
          <label className="grid gap-2 text-sm">Slug<input name="slug" defaultValue={values.slug} className="input-dark" placeholder="mesa-downtown-retreat" /><FieldError message={state.errors?.slug} /></label>
          <label className="grid gap-2 text-sm md:col-span-2">Headline<input name="headline" defaultValue={values.headline ?? ""} className="input-dark" placeholder="Boutique desert retreat minutes from downtown" /></label>
          <label className="grid gap-2 text-sm md:col-span-2">Short description<textarea name="short_description" defaultValue={values.short_description ?? ""} className="input-dark min-h-24" /></label>
          <label className="grid gap-2 text-sm md:col-span-2">Full description<textarea name="description" defaultValue={values.description} className="input-dark min-h-44" /><FieldError message={state.errors?.description} /></label>
          <label className="grid gap-2 text-sm">Property type<input name="property_type" defaultValue={values.property_type} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Status<select name="status" defaultValue={values.status} className="input-dark"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="font-serif text-3xl">Location & capacity</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm md:col-span-3">Address<input name="address" defaultValue={values.address ?? ""} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Neighborhood<input name="neighborhood" defaultValue={values.neighborhood ?? ""} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">City<input name="city" defaultValue={values.city} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">State<input name="state" defaultValue={values.state} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Bedrooms<input type="number" name="bedrooms" defaultValue={values.bedrooms} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Bathrooms<input type="number" step="0.5" name="bathrooms" defaultValue={values.bathrooms} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Max guests<input type="number" name="max_guests" defaultValue={values.max_guests} className="input-dark" /></label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="font-serif text-3xl">Pricing & stay rules</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm">Nightly rate<input type="number" name="nightly_rate" defaultValue={values.nightly_rate} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Cleaning fee<input type="number" name="cleaning_fee" defaultValue={values.cleaning_fee} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Service fee<input type="number" name="service_fee" defaultValue={values.service_fee} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Tax rate<input type="number" step="0.0001" name="tax_rate" defaultValue={values.tax_rate} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Minimum nights<input type="number" name="minimum_nights" defaultValue={values.minimum_nights} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Check-in<input name="check_in_time" defaultValue={values.check_in_time} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Check-out<input name="check_out_time" defaultValue={values.check_out_time} className="input-dark" /></label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="font-serif text-3xl">Content & images</h2>
        <p className="mt-2 text-sm text-white/50">Use one item per line for amenities, highlights, rules, and image URLs. Supabase Storage uploads are enabled in the next UI pass.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm md:col-span-2">Featured image URL<input name="featured_image" defaultValue={values.featured_image ?? ""} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">Amenities<textarea name="amenities" defaultValue={lines(values.amenities)} className="input-dark min-h-40" /></label>
          <label className="grid gap-2 text-sm">Highlights<textarea name="highlights" defaultValue={lines(values.highlights)} className="input-dark min-h-40" /></label>
          <label className="grid gap-2 text-sm">House rules<textarea name="house_rules" defaultValue={lines(values.house_rules)} className="input-dark min-h-40" /></label>
          <label className="grid gap-2 text-sm">Gallery image URLs<textarea name="images" defaultValue={lines(values.images)} className="input-dark min-h-40" /></label>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="font-serif text-3xl">SEO</h2>
        <div className="mt-6 grid gap-5">
          <label className="grid gap-2 text-sm">SEO title<input name="seo_title" defaultValue={values.seo_title ?? ""} className="input-dark" /></label>
          <label className="grid gap-2 text-sm">SEO description<textarea name="seo_description" defaultValue={values.seo_description ?? ""} className="input-dark min-h-28" /></label>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : property ? "Save property" : "Create property"}</Button>
      </div>
    </form>
  );
}
