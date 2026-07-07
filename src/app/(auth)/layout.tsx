import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ivory px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-950">Luxe Haven</Link>
        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="rounded-[2rem] bg-stone-950 p-10 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.32em] text-brass">Private portal</p>
            <h1 className="mt-6 font-serif text-4xl leading-tight md:text-5xl">Hospitality operations with owner-level clarity.</h1>
            <p className="mt-5 text-white/70">Access performance insights, property updates, booking activity, and Luxe Haven operating workflows from one secure portal.</p>
          </section>
          <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm md:p-10">{children}</section>
        </div>
      </div>
    </main>
  );
}
