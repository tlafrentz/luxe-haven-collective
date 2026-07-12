function CardSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-24 rounded bg-neutral-200" />
      <div className="mt-5 h-9 w-32 rounded bg-neutral-200" />
      <div className="mt-4 h-4 w-40 rounded bg-neutral-100" />
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <main className="space-y-6">
      <header>
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-neutral-100" />
      </header>

      <div className="h-32 animate-pulse rounded-2xl border border-neutral-200 bg-white" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </main>
  );
}
