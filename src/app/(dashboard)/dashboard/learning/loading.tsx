export default function LearningWorkspaceLoading() {
  return <div role="status" aria-live="polite" className="mx-auto max-w-5xl animate-pulse px-4 py-10 motion-reduce:animate-none sm:px-6"><span className="sr-only">Loading Continuous Improvement workspace</span><div className="h-48 rounded-3xl bg-stone-200" /><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-stone-100" />)}</div></div>;
}
