export function PortfolioWorkspaceSkeleton() {
  return <div role="status" aria-live="polite" aria-label="Loading Portfolio Intelligence workspace" className="mx-auto max-w-[1500px] animate-pulse space-y-6 px-4 py-8 motion-reduce:animate-none sm:px-6 lg:px-8">
    <span className="sr-only">Loading portfolio condition, capital position, and allocation priorities.</span>
    <div className="h-52 rounded-[2rem] bg-stone-200" />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-stone-200" />)}</div>
    <div className="grid gap-6 xl:grid-cols-2"><div className="h-96 rounded-[2rem] bg-stone-200" /><div className="h-96 rounded-[2rem] bg-stone-200" /></div>
    <div className="h-72 rounded-[2rem] bg-stone-200" />
  </div>;
}
