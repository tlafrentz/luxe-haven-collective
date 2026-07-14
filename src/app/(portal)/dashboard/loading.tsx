function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={[
        "animate-pulse rounded-2xl bg-stone-200/70",
        className,
      ].join(" ")}
    />
  );
}

export default function DashboardLoading() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <div className="space-y-4">
          <SkeletonBlock className="h-7 w-48" />
          <SkeletonBlock className="h-12 max-w-3xl" />
          <SkeletonBlock className="h-6 max-w-xl" />
        </div>

        <SkeletonBlock className="h-32 w-full rounded-3xl" />

        <SkeletonBlock className="h-[420px] w-full rounded-3xl" />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-56 w-full" />
            <SkeletonBlock className="h-56 w-full" />
          </div>

          <div className="space-y-6">
            <SkeletonBlock className="h-96 w-full" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
