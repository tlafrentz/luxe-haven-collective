"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  Check,
  Palette,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  getPublishedGuidebookTemplates,
  getPublishedGuidebookTemplateVersions,
  type PublishedGuidebookTemplate,
} from "@/app/actions/guidebook-templates";
import { createCustomerCreationJobAction, getCustomerCreationCapabilityAction } from "@/app/actions/guidebook-ai-creation";
import {
  AiGeneratingStep,
  AiReviewStep,
  AiStyleStep,
  AiTrustBanner,
  AiUploadStep,
  beginAiExtraction,
  beginAiGeneration,
} from "./ai-creation-steps";
import { usStates, usTimeZones } from "./property-options";

type PropertyOption = Readonly<{
  id: string;
  name: string;
  location: string;
  image: string | null;
  capabilities: readonly string[];
  hasActiveGuidebook: boolean;
  existingGuidebookId?: string | null;
}>;
type StepId =
  | "welcome"
  | "property"
  | "method"
  | "style"
  | "template"
  | "brand"
  | "details"
  | "create"
  | "ai-upload"
  | "ai-review"
  | "ai-style"
  | "ai-generating";
type StepDef = Readonly<{ id: StepId; label: string }>;
const baseSteps: readonly StepDef[] = [
  { id: "welcome", label: "Welcome" },
  { id: "property", label: "Property" },
  { id: "method", label: "Method" },
];
const templateSteps: readonly StepDef[] = [
  ...baseSteps,
  { id: "style", label: "Style" },
  { id: "template", label: "Template" },
  { id: "brand", label: "Brand" },
  { id: "details", label: "Details" },
  { id: "create", label: "Create" },
];
const blankSteps: readonly StepDef[] = [
  ...baseSteps,
  { id: "details", label: "Details" },
  { id: "create", label: "Create" },
];
const aiSteps: readonly StepDef[] = [
  ...baseSteps,
  { id: "ai-upload", label: "Upload" },
  { id: "ai-review", label: "Review" },
  { id: "ai-style", label: "Style & Preferences" },
  { id: "ai-generating", label: "Generating" },
];
const styleOptions = [
  "Luxury",
  "Beach",
  "Cabin",
  "Family",
  "Minimal",
  "Boutique",
] as const;
const photographyStyles = [
  "Bright & Airy",
  "Warm & Moody",
  "Natural Light",
  "Editorial",
] as const;
const brandVoices = [
  "Warm & Welcoming",
  "Polished & Professional",
  "Playful & Casual",
  "Minimal & Direct",
] as const;
const emptyProperty = {
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
  propertyType: "single_family_home",
  timezone: "America/Chicago",
  bedrooms: "1",
  bathrooms: "1",
  guestCapacity: "2",
  shortDescription: "",
};
const emptyBrand = {
  logoUrl: "",
  primaryColor: "#0b2b24",
  accentColor: "#c78a38",
  photographyStyle: photographyStyles[0] as string,
  voice: brandVoices[0] as string,
};

export function GuidebookPublishingWizard({
  workspaceId,
  properties: initialProperties,
  initialPropertyId,
  initialPropertyFields,
  createAction,
  createPropertyAction,
  basePath = "/dashboard/guidebooks",
}: Readonly<{
  workspaceId: string;
  properties: readonly PropertyOption[];
  initialPropertyId?: string;
  initialPropertyFields?: Partial<typeof emptyProperty>;
  createAction: (formData: FormData) => Promise<void>;
  createPropertyAction?: typeof import("@/app/actions/guidebook-authoring").createGuidebookPropertyAction;
  basePath?: string;
}>) {
  const [properties, setProperties] = useState([...initialProperties]);
  const [step, setStep] = useState(0),
    [mode, setMode] = useState<"choice" | "existing" | "new">(
      initialProperties.length ? "choice" : "new",
    ),
    [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [creationMode, setCreationMode] = useState<"template" | "ai" | "blank">("template");
  const [fields, setFields] = useState({
      ...emptyProperty,
      ...initialPropertyFields,
    }),
    [title, setTitle] = useState(""),
    [slug, setSlug] = useState(""),
    [locale, setLocale] = useState("en-US"),
    [description, setDescription] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [templates, setTemplates] = useState<PublishedGuidebookTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [brand, setBrand] = useState(emptyBrand);
  const [brandSkipped, setBrandSkipped] = useState(false);
  const [error, setError] = useState(""),
    [duplicateId, setDuplicateId] = useState(""),
    [pending, startTransition] = useTransition();

  // Auto-create with AI state.
  const [aiCapabilityAvailable, setAiCapabilityAvailable] = useState<boolean | null>(null);
  const [aiStarting, setAiStarting] = useState(false);
  const [aiJobId, setAiJobId] = useState("");
  const [aiTemplateName, setAiTemplateName] = useState("");
  const [aiSourceCount, setAiSourceCount] = useState(0);
  const [aiUploadError, setAiUploadError] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [aiToneOfVoice, setAiToneOfVoice] = useState("");
  const [aiLanguage, setAiLanguage] = useState("");
  const [aiPrimaryColor, setAiPrimaryColor] = useState("");
  const [aiAccentColor, setAiAccentColor] = useState("");
  const [aiQueuing, setAiQueuing] = useState(false);

  const property = properties.find((item) => item.id === propertyId);
  const suggestedTitle = property
    ? `${property.name} Guest Guide`
    : "Guest Guide";
  const selectedTemplate = templates.find((item) => item.id === templateId);

  const activeSteps = creationMode === "ai" ? aiSteps : creationMode === "blank" ? blankSteps : templateSteps;
  const stepId: StepId = activeSteps[step]?.id ?? "welcome";

  useEffect(() => {
    if (stepId !== "template") return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setTemplatesLoading(true);
    });
    getPublishedGuidebookTemplates(
      styleFilter ? styleFilter.toLowerCase() : undefined,
    )
      .then((result) => {
        if (cancelled) return;
        setTemplates(result);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stepId, styleFilter]);

  useEffect(() => {
    if (stepId !== "method" || !propertyId) return;
    let cancelled = false;
    getCustomerCreationCapabilityAction(workspaceId, propertyId)
      .then((result) => {
        if (!cancelled) setAiCapabilityAvailable(result.available);
      })
      .catch(() => {
        if (!cancelled) setAiCapabilityAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stepId, propertyId, workspaceId]);

  const canContinue =
    stepId === "welcome"
      ? true
      : stepId === "property"
        ? Boolean(propertyId)
        : stepId === "method"
          ? false
          : stepId === "style"
            ? true
            : stepId === "template"
              ? Boolean(templateId)
              : stepId === "brand"
                ? true
                : stepId === "details"
                  ? Boolean((title || suggestedTitle).trim())
                  : stepId === "ai-upload"
                    ? aiSourceCount > 0
                    : stepId === "ai-review"
                      ? aiReady
                      : stepId === "ai-style"
                        ? true
                        : true;
  function chooseProperty(id: string) {
    setPropertyId(id);
    setError("");
  }
  function saveProperty(createAnyway = false) {
    if (!createPropertyAction) {
      setError("Property creation is unavailable.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createPropertyAction({
        workspaceId,
        ...fields,
        bedrooms: fields.bedrooms ? Number(fields.bedrooms) : undefined,
        bathrooms: fields.bathrooms ? Number(fields.bathrooms) : undefined,
        guestCapacity: Number(fields.guestCapacity),
        createAnyway,
        commandId: crypto.randomUUID(),
      });
      if (result.ok) {
        setProperties((value) => [...value, result.property]);
        chooseProperty(result.property.id);
        setMode("existing");
        setDuplicateId("");
      } else if (result.code === "DUPLICATE_PROPERTY") {
        setDuplicateId(result.duplicatePropertyId ?? "");
        setError(result.message);
      } else setError(result.message);
    });
  }
  function next() {
    if (stepId === "property" && !propertyId) return;
    if (stepId === "details" && !title) {
      setTitle(suggestedTitle);
      setSlug(slugify(suggestedTitle));
    }
    setStep((value) => Math.min(activeSteps.length - 1, value + 1));
  }
  function back() {
    setStep((value) => Math.max(0, value - 1));
  }
  async function chooseMode(selected: "template" | "ai" | "blank") {
    setCreationMode(selected);
    if (selected !== "ai") {
      setStep((value) => value + 1);
      return;
    }
    if (aiStarting) return;
    setAiStarting(true);
    setAiUploadError("");
    try {
      const versions = await getPublishedGuidebookTemplateVersions();
      const chosen = versions[0];
      if (!chosen) throw new Error("No approved template is available yet.");
      const created = await createCustomerCreationJobAction({
        workspaceId,
        propertyId,
        templateVersionId: chosen.versionId,
        idempotencyKey: `ai-create:${propertyId}:${crypto.randomUUID()}`,
      });
      setAiJobId(created.jobId);
      setAiTemplateName(chosen.name);
      setStep((value) => value + 1);
    } catch (startError) {
      setAiUploadError(startError instanceof Error ? startError.message : "Could not start AI auto-create.");
    } finally {
      setAiStarting(false);
    }
  }
  async function continueFromAiUpload() {
    if (!canContinue || aiQueuing) return;
    setAiQueuing(true);
    try {
      await beginAiExtraction(workspaceId, propertyId, aiJobId);
      next();
    } finally {
      setAiQueuing(false);
    }
  }
  async function continueFromAiStyle() {
    if (aiQueuing) return;
    setAiQueuing(true);
    try {
      await beginAiGeneration(workspaceId, propertyId, aiJobId, title || suggestedTitle, {
        toneOfVoice: aiToneOfVoice || undefined,
        language: aiLanguage || undefined,
      });
      next();
    } finally {
      setAiQueuing(false);
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 py-8">
      <header>
        <Link href={basePath} className="text-sm font-semibold text-blue-700">
          ← Guidebooks
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">New Guidebook</h1>
      </header>
      <ol
        aria-label="Guidebook creation progress"
        className="grid auto-cols-fr grid-flow-col border-b pb-5"
      >
        {activeSteps.map((definition, index) => (
          <li
            key={definition.id}
            aria-current={step === index ? "step" : undefined}
            className={`flex items-center gap-2 text-sm ${index <= step ? "font-semibold text-blue-700" : "text-stone-400"}`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full border">
              {index < step ? <Check className="size-4" /> : index + 1}
            </span>
            {definition.label}
          </li>
        ))}
      </ol>
      <section className="min-h-[32rem] rounded-2xl border bg-white p-7">
        {stepId === "welcome" ? (
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700">
              <Sparkles className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold">
              Welcome to Guidebook Studio!
            </h2>
            <p className="mt-3 text-stone-600">
              Let&apos;s create a guidebook that your guests will love.
            </p>
            <ul className="mx-auto mt-7 max-w-xs space-y-3 text-left">
              {["Simple steps", "Beautiful results", "Happy guests"].map(
                (item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm font-medium text-stone-700"
                  >
                    <Check className="size-5 text-emerald-600" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-stone-400">
              This will take about 10 minutes.
            </p>
          </div>
        ) : null}
        {stepId === "property" ? (
          <>
            <h2 className="text-2xl font-semibold">
              Which property is this guidebook for?
            </h2>
            {mode === "choice" ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <Choice
                  icon={<Building2 />}
                  title="Select Existing Property"
                  body="Choose from properties in this workspace."
                  onClick={() => setMode("existing")}
                />
                <Choice
                  icon={<Plus />}
                  title="Add New Property"
                  body="Create a canonical property without an HPM subscription."
                  onClick={() => setMode("new")}
                />
              </div>
            ) : mode === "existing" ? (
              <div className="mt-6">
                <button
                  onClick={() => setMode("choice")}
                  className="text-sm font-semibold text-blue-700"
                >
                  ← Property options
                </button>
                {properties.length ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {properties.map((item) => {
                      const card = (
                        <>
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt=""
                              width={420}
                              height={180}
                              className="h-28 w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-28 place-items-center bg-stone-100">
                              <Building2 className="text-stone-400" />
                            </div>
                          )}
                          <span className="block p-4">
                            <strong>{item.name}</strong>
                            <small className="mt-1 block text-stone-500">
                              {item.location}
                            </small>
                            <span className="mt-3 flex flex-wrap gap-1.5">
                              {item.capabilities.map((capability) => (
                                <small
                                  key={capability}
                                  className="rounded-full bg-stone-100 px-2 py-1 font-medium capitalize text-stone-600"
                                >
                                  {capability === "hpm" ? "HPM" : capability}
                                </small>
                              ))}
                              {item.hasActiveGuidebook ? (
                                <small className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">
                                  Active guidebook exists
                                </small>
                              ) : null}
                              {item.existingGuidebookId ? (
                                <small className="mt-3 block font-semibold text-blue-700">
                                  Open guidebook →
                                </small>
                              ) : null}
                            </span>
                          </span>
                        </>
                      );
                      return item.existingGuidebookId ? (
                        <Link
                          key={item.id}
                          href={`${basePath}/${item.existingGuidebookId}/edit`}
                          aria-label={`Open guidebook for ${item.name}`}
                          className="overflow-hidden rounded-xl border text-left transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        >
                          {card}
                        </Link>
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => chooseProperty(item.id)}
                          aria-label={item.name}
                          className={`overflow-hidden rounded-xl border text-left ${item.id === propertyId ? "ring-2 ring-blue-600" : ""}`}
                        >
                          {card}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-10 rounded-xl border border-dashed p-8 text-center">
                    <p className="font-semibold">
                      Add your first guidebook property
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      You can publish a complete guidebook without enrolling in
                      HPM.
                    </p>
                    <button
                      onClick={() => setMode("new")}
                      className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Add New Property
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!properties.length ? (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                    <strong>Add your first guidebook property.</strong> Only the
                    details guests need are required. HPM enrollment is not
                    required.
                  </div>
                ) : null}
                <PropertyForm
                  fields={fields}
                  setFields={setFields}
                  pending={pending}
                  error={error}
                  duplicate={properties.find((item) => item.id === duplicateId)}
                  onSave={() => saveProperty()}
                  onExisting={() => {
                    chooseProperty(duplicateId);
                    setMode("existing");
                    setDuplicateId("");
                  }}
                  onAnyway={() => saveProperty(true)}
                  onBack={() => setMode(properties.length ? "choice" : "new")}
                />
              </>
            )}
          </>
        ) : null}
        {stepId === "method" ? (
          <>
            <h2 className="text-2xl font-semibold">How do you want to create it?</h2>
            <p className="mt-2 text-sm text-stone-500">You can always add or change content later in the Builder.</p>
            <AiTrustBanner />
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <ModeChoice
                icon={<Sparkles />}
                title="Auto-create with AI"
                body="Upload your content and let AI build a first draft."
                recommended
                disabled={aiStarting || aiCapabilityAvailable === false}
                busy={aiStarting}
                unavailable={aiCapabilityAvailable === false}
                onClick={() => chooseMode("ai")}
              />
              <ModeChoice
                icon={<Palette />}
                title="Start from a template"
                body="Choose a template and customize it."
                onClick={() => chooseMode("template")}
              />
              <ModeChoice
                icon={<Plus />}
                title="Start blank"
                body="Build your guidebook from scratch."
                onClick={() => chooseMode("blank")}
              />
            </div>
            {aiUploadError ? (
              <p role="alert" className="mt-4 text-sm text-amber-800">
                <TriangleAlert className="mr-1 inline size-4" />
                {aiUploadError}
              </p>
            ) : null}
          </>
        ) : null}
        {stepId === "style" ? (
          <>
            <h2 className="text-2xl font-semibold">
              Let&apos;s match your style.
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              This helps us recommend the right templates. You can skip this
              step.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {styleOptions.map((option) => (
                <button
                  key={option}
                  onClick={() =>
                    setStyleFilter((current) =>
                      current === option ? "" : option,
                    )
                  }
                  className={`rounded-xl border p-6 text-left transition ${
                    styleFilter === option
                      ? "border-blue-600 bg-blue-50"
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                >
                  <Palette className="size-5 text-blue-700" />
                  <p className="mt-4 font-semibold">{option}</p>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {stepId === "template" ? (
          <>
            <h2 className="text-2xl font-semibold">
              Choose a template to get started.
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {["All", ...styleOptions].map((option) => {
                const value = option === "All" ? "" : option;
                const isActive = styleFilter === value;
                return (
                  <button
                    key={option}
                    onClick={() => setStyleFilter(value)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
                      isActive
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-stone-300 text-stone-600"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {templatesLoading ? (
              <p className="mt-8 text-sm text-stone-500">Loading templates…</p>
            ) : templates.length ? (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const isSelected = template.id === templateId;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setTemplateId(template.id)}
                      className={`overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition ${
                        isSelected
                          ? "border-blue-600"
                          : "border-transparent hover:border-stone-300"
                      }`}
                    >
                      <div className="h-32 bg-gradient-to-br from-[#0b2b24] via-[#c78a38] to-[#f4ead7]" />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{template.name}</h3>
                            <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                              {template.category}
                            </p>
                          </div>
                          {isSelected ? (
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-700 text-white">
                              <Check className="size-3.5" />
                            </span>
                          ) : null}
                        </div>
                        {template.description ? (
                          <p className="mt-2 text-sm leading-6 text-stone-500">
                            {template.description}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-8 text-sm text-stone-500">
                No published templates match this style yet. Try
                &quot;All&quot;.
              </p>
            )}
            {selectedTemplate ? (
              <p className="mt-5 text-sm font-medium text-blue-700">
                Selected: {selectedTemplate.name}
              </p>
            ) : null}
          </>
        ) : null}
        {stepId === "brand" ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Add your brand identity.
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                Optional
              </span>
            </div>
            <div className="mt-6 grid max-w-2xl gap-5">
              <label className="text-sm font-semibold">
                Logo URL
                <input
                  value={brand.logoUrl}
                  onChange={(event) =>
                    setBrand((current) => ({
                      ...current,
                      logoUrl: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  className="mt-2 block min-h-11 w-full rounded-lg border px-3"
                />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Primary Color
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={brand.primaryColor}
                      onChange={(event) =>
                        setBrand((current) => ({
                          ...current,
                          primaryColor: event.target.value,
                        }))
                      }
                      className="size-11 rounded-lg border"
                    />
                    <input
                      value={brand.primaryColor}
                      onChange={(event) =>
                        setBrand((current) => ({
                          ...current,
                          primaryColor: event.target.value,
                        }))
                      }
                      className="min-h-11 w-full rounded-lg border px-3"
                    />
                  </div>
                </label>
                <label className="text-sm font-semibold">
                  Accent Color
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={brand.accentColor}
                      onChange={(event) =>
                        setBrand((current) => ({
                          ...current,
                          accentColor: event.target.value,
                        }))
                      }
                      className="size-11 rounded-lg border"
                    />
                    <input
                      value={brand.accentColor}
                      onChange={(event) =>
                        setBrand((current) => ({
                          ...current,
                          accentColor: event.target.value,
                        }))
                      }
                      className="min-h-11 w-full rounded-lg border px-3"
                    />
                  </div>
                </label>
              </div>
              <label className="text-sm font-semibold">
                Photography Style
                <select
                  value={brand.photographyStyle}
                  onChange={(event) =>
                    setBrand((current) => ({
                      ...current,
                      photographyStyle: event.target.value,
                    }))
                  }
                  className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3"
                >
                  {photographyStyles.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Brand Voice
                <select
                  value={brand.voice}
                  onChange={(event) =>
                    setBrand((current) => ({
                      ...current,
                      voice: event.target.value,
                    }))
                  }
                  className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3"
                >
                  {brandVoices.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              onClick={() => setBrandSkipped(true)}
              className="mt-5 text-sm font-semibold text-stone-500 underline"
            >
              Skip for now
            </button>
          </>
        ) : null}
        {stepId === "details" ? (
          <>
            <h2 className="text-2xl font-semibold">Guidebook details</h2>
            <div className="mt-6 grid max-w-2xl gap-5">
              <Field
                label="Guidebook name *"
                value={title || suggestedTitle}
                onChange={(value) => {
                  setTitle(value);
                  setSlug(slugify(value));
                }}
              />
              <Field
                label="Slug *"
                value={slug || slugify(suggestedTitle)}
                onChange={setSlug}
              />
              <label className="text-sm font-semibold">
                Default locale *
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  className="mt-2 block min-h-11 w-full rounded-lg border px-3"
                >
                  <option>en-US</option>
                  <option>es-US</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="mt-2 block w-full rounded-lg border p-3"
                />
              </label>
            </div>
          </>
        ) : null}
        {stepId === "create" ? (
          <>
            <h2 className="text-2xl font-semibold">Create your draft?</h2>
            <dl className="mt-6 grid max-w-2xl grid-cols-[10rem_1fr] gap-3 rounded-xl bg-stone-50 p-5 text-sm">
              <dt>Property</dt>
              <dd className="font-semibold">{property?.name}</dd>
              {creationMode === "template" ? (
                <>
                  <dt>Template</dt>
                  <dd className="font-semibold">{selectedTemplate?.name ?? "—"}</dd>
                  <dt>Brand identity</dt>
                  <dd className="font-semibold">
                    {brandSkipped ? "Skipped" : "Configured"}
                  </dd>
                </>
              ) : null}
              <dt>Name</dt>
              <dd className="font-semibold">{title || suggestedTitle}</dd>
              <dt>Locale</dt>
              <dd>{locale}</dd>
            </dl>
            <p className="mt-5 text-sm text-stone-600">
              The Builder will open with your selected {creationMode === "blank" ? "" : "template's "}starter
              section structure. Preview and publishing come next.
            </p>
          </>
        ) : null}
        {stepId === "ai-upload" ? (
          <AiUploadStep
            workspaceId={workspaceId}
            propertyId={propertyId}
            jobId={aiJobId}
            sourceCount={aiSourceCount}
            onUploaded={() => setAiSourceCount((value) => value + 1)}
            error={aiUploadError}
            setError={setAiUploadError}
          />
        ) : null}
        {stepId === "ai-review" ? (
          <AiReviewStep
            workspaceId={workspaceId}
            propertyId={propertyId}
            jobId={aiJobId}
            onReadyChange={setAiReady}
          />
        ) : null}
        {stepId === "ai-style" ? (
          <AiStyleStep
            workspaceId={workspaceId}
            title={title || suggestedTitle}
            setTitle={setTitle}
            toneOfVoice={aiToneOfVoice}
            setToneOfVoice={setAiToneOfVoice}
            language={aiLanguage}
            setLanguage={setAiLanguage}
            primaryColor={aiPrimaryColor}
            setPrimaryColor={setAiPrimaryColor}
            accentColor={aiAccentColor}
            setAccentColor={setAiAccentColor}
            templateName={aiTemplateName}
          />
        ) : null}
        {stepId === "ai-generating" ? (
          <AiGeneratingStep workspaceId={workspaceId} propertyId={propertyId} jobId={aiJobId} basePath={basePath} />
        ) : null}
      </section>
      <footer className="flex justify-between">
        <button
          onClick={back}
          disabled={!step || stepId === "ai-generating"}
          className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:invisible"
        >
          Back
        </button>
        {stepId === "method" || stepId === "ai-generating" ? null : stepId ===
          "create" ? (
          <form action={createAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="title" value={title || suggestedTitle} />
            <input
              type="hidden"
              name="slug"
              value={slug || slugify(suggestedTitle)}
            />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="templateId" value={templateId} />
            {creationMode === "template" && !brandSkipped ? (
              <>
                <input
                  type="hidden"
                  name="brandLogoUrl"
                  value={brand.logoUrl}
                />
                <input
                  type="hidden"
                  name="brandPrimaryColor"
                  value={brand.primaryColor}
                />
                <input
                  type="hidden"
                  name="brandAccentColor"
                  value={brand.accentColor}
                />
              </>
            ) : null}
            <input
              type="hidden"
              name="commandId"
              value={`gs-v1a:${propertyId}`}
            />
            <button className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white">
              Create Guidebook
            </button>
          </form>
        ) : (
          <button
            onClick={
              stepId === "ai-upload"
                ? continueFromAiUpload
                : stepId === "ai-style"
                  ? continueFromAiStyle
                  : next
            }
            disabled={!canContinue || pending || aiQueuing}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {stepId === "welcome" ? "Let's Get Started" : aiQueuing ? "Please wait…" : "Continue"}
          </button>
        )}
      </footer>
    </main>
  );
}
function Choice({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-56 rounded-xl border p-8 text-left hover:border-blue-500"
    >
      <span className="grid size-12 place-items-center rounded-full border text-blue-700">
        {icon}
      </span>
      <strong className="mt-6 block">{title}</strong>
      <span className="mt-2 block text-sm text-stone-500">{body}</span>
    </button>
  );
}
function ModeChoice({
  icon,
  title,
  body,
  onClick,
  recommended,
  disabled,
  busy,
  unavailable,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  recommended?: boolean;
  disabled?: boolean;
  busy?: boolean;
  unavailable?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-h-56 rounded-xl border p-8 text-left hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {recommended ? (
        <span className="mb-3 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Recommended</span>
      ) : null}
      <span className="grid size-12 place-items-center rounded-full border text-blue-700">
        {icon}
      </span>
      <strong className="mt-6 block">{title}</strong>
      <span className="mt-2 block text-sm text-stone-500">{body}</span>
      {busy ? <span className="mt-3 block text-xs font-semibold text-blue-700">Starting…</span> : null}
      {unavailable ? <span className="mt-3 block text-xs font-semibold text-stone-400">Coming soon for this workspace</span> : null}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block min-h-11 w-full rounded-lg border px-3"
      />
    </label>
  );
}
function PropertyForm({
  fields,
  setFields,
  pending,
  error,
  duplicate,
  onSave,
  onExisting,
  onAnyway,
  onBack,
}: {
  fields: typeof emptyProperty;
  setFields: React.Dispatch<React.SetStateAction<typeof emptyProperty>>;
  pending: boolean;
  error: string;
  duplicate?: PropertyOption;
  onSave: () => void;
  onExisting: () => void;
  onAnyway: () => void;
  onBack: () => void;
}) {
  const update = (key: keyof typeof fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  return (
    <div className="mt-6">
      <button onClick={onBack} className="text-sm font-semibold text-blue-700">
        ← Property options
      </button>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(
          [
            ["name", "Property name *"],
            ["address", "Street address (optional)"],
            ["city", "City *"],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={fields[key]}
            onChange={(value) => update(key, value)}
          />
        ))}
        <label className="text-sm font-semibold">
          State / region *
          <select
            value={fields.state}
            onChange={(event) => update("state", event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3"
          >
            <option value="" disabled>
              Select a state
            </option>
            {usStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["postalCode", "Postal code (optional)"],
            ["country", "Country *"],
          ] as const
        ).map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={fields[key]}
            onChange={(value) => update(key, value)}
          />
        ))}
        <label className="text-sm font-semibold">
          Property type *
          <select
            value={fields.propertyType}
            onChange={(event) => update("propertyType", event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-lg border px-3"
          >
            <option value="single_family_home">Single family home</option>
            <option value="apartment">Apartment</option>
            <option value="condo">Condo</option>
            <option value="cabin">Cabin</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Time zone *
          <select
            value={fields.timezone}
            onChange={(event) => update("timezone", event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3"
          >
            {usTimeZones.map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Bedrooms"
          value={fields.bedrooms}
          onChange={(value) => update("bedrooms", value)}
        />
        <Field
          label="Bathrooms"
          value={fields.bathrooms}
          onChange={(value) => update("bathrooms", value)}
        />
        <Field
          label="Maximum guest capacity *"
          value={fields.guestCapacity}
          onChange={(value) => update("guestCapacity", value)}
        />
      </div>
      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          <TriangleAlert className="mr-2 inline size-4" />
          {error}
          {duplicate ? (
            <div className="mt-3">
              <strong>{duplicate.name}</strong>
              <p>{duplicate.location}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onExisting}
                  className="rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white"
                >
                  Use Existing Property
                </button>
                <button
                  onClick={onAnyway}
                  className="rounded-lg border bg-white px-3 py-2 font-semibold"
                >
                  Create Anyway
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        onClick={onSave}
        disabled={pending}
        className="mt-6 rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Property"}
      </button>
    </div>
  );
}
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
