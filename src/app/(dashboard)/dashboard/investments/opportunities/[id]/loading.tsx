const block = "animate-pulse rounded-xl bg-stone-100 motion-reduce:animate-none";
export default function InvestmentOpportunityWorkspaceLoading() {
  return <main aria-busy="true" aria-label="Loading investment opportunity workspace" className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div className={`${block} h-4 w-80 max-w-full`} />
    <header className="space-y-4 border-b border-stone-200 pb-8"><div className={`${block} h-6 w-56`} /><div className={`${block} h-12 w-[34rem] max-w-full`} /><div className={`${block} h-5 w-72 max-w-full`} /></header>
    <section aria-label="Loading summary" className="grid gap-5 lg:grid-cols-2"><SkeletonCard rows={3} /><SkeletonCard rows={3} /></section>
    <section aria-label="Loading acquisition lifecycle"><SkeletonCard rows={2} wide /></section>
    <section aria-label="Loading commercial and requirements" className="grid gap-5 xl:grid-cols-2"><SkeletonCard rows={4} /><SkeletonCard rows={4} /></section>
    <section aria-label="Loading closing readiness"><SkeletonCard rows={2} wide /></section>
    <section aria-label="Loading recent activity"><SkeletonCard rows={4} wide /></section>
    <section aria-label="Loading next actions"><SkeletonCard rows={2} wide /></section>
  </main>;
}
function SkeletonCard({ rows, wide = false }: { rows: number; wide?: boolean }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className={`${block} h-6 ${wide ? "w-64" : "w-44"}`} /><div className="mt-6 space-y-3">{Array.from({ length: rows }, (_, index) => <div key={index} className={`${block} h-12 w-full`} />)}</div></div>;
}
