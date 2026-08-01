"use client";
import { useEffect, useRef, useState } from "react";
import { SafeImage } from "@/components/shared/safe-image";
import type {
  PublicGuidebookBlock,
  PublicGuidebookView,
} from "@/features/guidebook-studio";

export function PublicGuidebookExperience({
  slug,
  guidebook,
  source,
  trackEvents = true,
}: {
  slug: string;
  guidebook: PublicGuidebookView;
  source: "link" | "qr";
  trackEvents?: boolean;
}) {
  const [active, setActive] = useState(guidebook.sections[0]?.key ?? ""),
    [progress, setProgress] = useState(0),
    [online, setOnline] = useState(true),
    session = useRef("");
  useEffect(() => {
    session.current =
      sessionStorage.getItem("guidebook-session") ?? crypto.randomUUID();
    sessionStorage.setItem("guidebook-session", session.current);
    if (trackEvents)
      void event(slug, {
        eventType: source === "qr" ? "qr-scan" : "view",
        sessionId: session.current,
        artifactVersion: guidebook.meta.artifactVersion,
        rendererVersion: guidebook.meta.rendererVersion,
      });
    if (trackEvents && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/guidebook-sw.js", {
        scope: "/g/",
      });
    const connectivity = () => setOnline(navigator.onLine);
    connectivity();
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => {
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, [
    guidebook.meta.artifactVersion,
    guidebook.meta.rendererVersion,
    slug,
    source,
    trackEvents,
  ]);
  useEffect(() => {
    const viewed = new Set<string>();
    let completed = false;
    const update = () => {
      const maximum =
          document.documentElement.scrollHeight - window.innerHeight,
        value =
          maximum > 0
            ? Math.min(100, Math.round((window.scrollY / maximum) * 100))
            : 100;
      setProgress(value);
      const sections = guidebook.sections
        .map((section) => ({
          section,
          element: document.getElementById(section.key),
        }))
        .filter((item) => item.element);
      const current =
        [...sections]
          .reverse()
          .find((item) => item.element!.getBoundingClientRect().top <= 150) ??
        sections[0];
      if (current) {
        setActive(current.section.key);
        if (trackEvents && !viewed.has(current.section.key)) {
          viewed.add(current.section.key);
          void event(slug, {
            eventType: "section-open",
            sectionKey: current.section.key,
            sessionId: session.current,
            artifactVersion: guidebook.meta.artifactVersion,
            rendererVersion: guidebook.meta.rendererVersion,
          });
        }
      }
      if (trackEvents && value >= 95 && !completed) {
        completed = true;
        void event(slug, {
          eventType: "guidebook-completed",
          sessionId: session.current,
          artifactVersion: guidebook.meta.artifactVersion,
          rendererVersion: guidebook.meta.rendererVersion,
        });
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [
    guidebook.meta.artifactVersion,
    guidebook.meta.rendererVersion,
    guidebook.sections,
    slug,
    trackEvents,
  ]);
  const track = (eventType: string, sectionKey: string, targetKind: string) => {
    if (trackEvents)
      void event(slug, {
        eventType,
        sectionKey,
        targetKind,
        sessionId: session.current,
        artifactVersion: guidebook.meta.artifactVersion,
        rendererVersion: guidebook.meta.rendererVersion,
      });
  };
  return (
    <main
      className="min-h-screen bg-[#f2ede4]"
      style={
        {
          "--guide-primary": guidebook.theme.primaryColor,
          "--guide-accent": guidebook.theme.accentColor,
        } as React.CSSProperties
      }
    >
      {!online ? (
        <p
          role="status"
          className="sticky top-0 z-50 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-950"
        >
          You&apos;re offline. Showing the most recently cached guidebook.
        </p>
      ) : null}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-black/10">
        <div
          className="h-full bg-[var(--guide-accent)] transition-[width] motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      <article className="mx-auto min-h-screen max-w-6xl bg-[#fbf8f1] shadow-[0_24px_80px_rgba(50,40,25,.12)]">
        <Hero guidebook={guidebook} />
        <nav
          aria-label="Guidebook sections"
          className="sticky top-0 z-40 border-y border-stone-200/80 bg-[#fbf8f1]/95 px-3 py-3 backdrop-blur"
        >
          <ul className="mx-auto flex max-w-5xl gap-2 overflow-x-auto pb-1">
            {guidebook.sections.map((section) => (
              <li key={section.key}>
                <a
                  href={`#${section.key}`}
                  aria-current={active === section.key ? "location" : undefined}
                  className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-accent)] ${active === section.key ? "bg-[var(--guide-primary)] text-white" : "border border-stone-300 bg-white text-stone-800"}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mx-auto max-w-4xl space-y-14 px-5 py-10 sm:px-8 sm:py-14">
          {guidebook.sections.map((section, index) => (
            <section
              id={section.key}
              className="scroll-mt-24"
              key={section.id}
              aria-labelledby={`heading-${section.key}`}
            >
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--guide-accent)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2
                id={`heading-${section.key}`}
                className="mt-2 font-serif text-3xl leading-tight text-stone-950 sm:text-4xl"
              >
                {section.title}
              </h2>
              <div className="mt-6 space-y-5">
                {section.blocks.map((block) => (
                  <PublicBlock
                    block={block}
                    sectionKey={section.key}
                    track={track}
                    key={block.id}
                  />
                ))}
              </div>
            </section>
          ))}
          {guidebook.recommendations.length ? (
            <Recommendations items={guidebook.recommendations} track={track} />
          ) : null}
        </div>
        <footer className="border-t border-stone-200 bg-white px-6 py-10 text-center">
          <p className="font-serif text-xl text-stone-900">Enjoy your stay.</p>
          <p className="mt-2 text-xs text-stone-500">
            Published{" "}
            {new Date(guidebook.meta.publishedAt).toLocaleDateString()} ·
            Guidebook v{guidebook.meta.guidebookVersion}
          </p>
          <p className="mt-1 text-[10px] text-stone-400">
            Artifact {guidebook.meta.artifactVersion} · Renderer{" "}
            {guidebook.meta.rendererVersion}
          </p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-stone-600">
            Luxe Haven Collective
          </p>
        </footer>
      </article>
    </main>
  );
}
function Hero({ guidebook }: { guidebook: PublicGuidebookView }) {
  return (
    <header className="relative isolate overflow-hidden bg-[var(--guide-primary)] text-white">
      {guidebook.coverImage ? (
        <SafeImage
          src={guidebook.coverImage}
          alt={`Exterior or featured view of ${guidebook.propertyName}`}
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
      <div className="min-h-[30rem] px-6 py-16 sm:flex sm:min-h-[36rem] sm:items-end sm:px-12 sm:py-20">
        <div className="max-w-2xl">
          {guidebook.theme.logoUrl ? (
            <SafeImage
              src={guidebook.theme.logoUrl}
              alt="Luxe Haven Collective"
              width={150}
              height={48}
              className="mb-10 h-10 w-auto object-contain"
            />
          ) : (
            <p className="text-xs font-bold uppercase tracking-[.24em] text-[var(--guide-accent)]">
              Luxe Haven Collective
            </p>
          )}
          <p className="mt-8 text-sm font-semibold uppercase tracking-[.16em] text-white/80">
            {guidebook.propertyName}
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[.95] sm:text-7xl">
            Welcome home.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
            {guidebook.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {guidebook.checkInTime ? (
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                Check-in {guidebook.checkInTime}
              </span>
            ) : null}
            {guidebook.checkoutTime ? (
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                Checkout {guidebook.checkoutTime}
              </span>
            ) : null}
            {guidebook.hostContact ? (
              <a
                href={`tel:${guidebook.hostContact}`}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-950"
              >
                Contact host
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
function PublicBlock({
  block,
  sectionKey,
  track,
}: {
  block: PublicGuidebookBlock;
  sectionKey: string;
  track: (event: string, section: string, target: string) => void;
}) {
  if (block.type === "heading")
    return <h3 className="font-serif text-2xl text-stone-950">{block.text}</h3>;
  if (block.type === "callout")
    return (
      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 leading-7 text-amber-950"
      >
        {block.text}
      </div>
    );
  if (block.type === "checklist")
    return (
      <ul className="space-y-3">
        {block.items?.map((item) => (
          <li
            className="flex gap-3 rounded-xl bg-white p-4 shadow-sm"
            key={item}
          >
            <span aria-hidden>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  if (block.type === "instruction")
    return (
      <div className="rounded-2xl border bg-white p-5">
        <p className="font-semibold">{block.text}</p>
        {block.items?.length ? (
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-stone-700">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  if (block.type === "contact") {
    const phone = block.phone?.replace(/[^\d+]/g, "");
    return (
      <address className="rounded-2xl border bg-white p-5 not-italic">
        <p className="font-semibold">{block.name}</p>
        {block.role ? (
          <p className="text-sm text-stone-500">{block.role}</p>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={() => track("phone-tap", sectionKey, "contact")}
            className="mt-3 inline-flex min-h-12 items-center rounded-full bg-[var(--guide-primary)] px-5 py-3 font-semibold text-white"
          >
            Call {block.name}
          </a>
        ) : null}
      </address>
    );
  }
  if (block.type === "image" && block.url)
    return (
      <ZoomImage
        url={block.url}
        alt={block.alt ?? ""}
        caption={block.caption}
      />
    );
  if (block.type === "link" && block.url)
    return (
      <a
        href={block.url}
        target={external(block.url) ? "_blank" : undefined}
        rel={external(block.url) ? "noopener noreferrer" : undefined}
        onClick={() =>
          track(
            block.url!.startsWith("tel:") ? "phone-tap" : "link-click",
            sectionKey,
            block.type,
          )
        }
        className="inline-flex min-h-12 items-center rounded-full bg-[var(--guide-primary)] px-6 py-3 font-semibold text-white focus-visible:ring-2 focus-visible:ring-[var(--guide-accent)]"
      >
        {block.label ?? block.text ?? "Open"}
        <span className="ml-2" aria-hidden>
          ↗
        </span>
      </a>
    );
  if (block.type === "location")
    return block.url ? (
      <a
        href={block.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("map-open", sectionKey, "location")}
        className="block rounded-2xl border bg-white p-5 font-semibold shadow-sm"
      >
        Open map <span aria-hidden>↗</span>
        <span className="mt-1 block text-sm font-normal text-stone-500">
          {block.text}
        </span>
      </a>
    ) : (
      <p className="rounded-2xl bg-stone-100 p-5">{block.text}</p>
    );
  return (
    <p className="whitespace-pre-wrap text-base leading-8 text-stone-700">
      {block.text}
    </p>
  );
}
function ZoomImage({
  url,
  alt,
  caption,
}: {
  url: string;
  alt: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <figure>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-200 focus-visible:ring-2 focus-visible:ring-[var(--guide-accent)]"
        aria-label={`Enlarge image: ${alt}`}
      >
        <SafeImage
          src={url}
          alt={alt}
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover transition-transform duration-300 hover:scale-[1.02] motion-reduce:transition-none"
        />
      </button>
      {caption ? (
        <figcaption className="mt-2 text-sm text-stone-500">
          {caption}
        </figcaption>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 font-semibold text-black">
            Close
          </button>
          <SafeImage
            src={url}
            alt={alt}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[90vh] w-auto rounded-xl object-contain"
          />
        </div>
      ) : null}
    </figure>
  );
}
function Recommendations({
  items,
  track,
}: {
  items: PublicGuidebookView["recommendations"];
  track: (event: string, section: string, target: string) => void;
}) {
  return (
    <section id="recommendations" className="scroll-mt-24">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--guide-accent)]">
        Local knowledge
      </p>
      <h2 className="mt-2 font-serif text-4xl">Places we love</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--guide-accent)]">
              {item.category}
            </p>
            <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 leading-7 text-stone-600">{item.description}</p>
            <div className="mt-4 flex gap-3">
              {item.website ? (
                <a
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    track("link-click", "recommendations", "website")
                  }
                  className="text-sm font-semibold underline"
                >
                  Website
                </a>
              ) : null}
              {item.mapUrl ? (
                <a
                  href={item.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("map-open", "recommendations", "map")}
                  className="text-sm font-semibold underline"
                >
                  Map
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function external(url: string) {
  return /^https?:/i.test(url);
}
async function event(slug: string, payload: Record<string, unknown>) {
  try {
    await fetch(`/api/public/guidebooks/${encodeURIComponent(slug)}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}
