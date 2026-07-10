export function SaveBar() {
  return (
    <div className="sticky bottom-4 mt-8 rounded-full border border-white/10 bg-stone-950/90 px-5 py-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-white/55">Changes are saved when you submit the form.</p>

        <button
          type="submit"
          form="property-editor-form"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Save property
        </button>
      </div>
    </div>
  );
}
