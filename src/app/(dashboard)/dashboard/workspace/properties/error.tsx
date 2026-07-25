"use client";

export default function ErrorState({ reset }: Readonly<{ reset: () => void }>) {
  return <main className="mx-auto max-w-5xl px-6 py-12"><h1 className="text-2xl font-semibold">Properties could not be loaded</h1><p className="mt-2 text-stone-600">No configuration was changed. Try loading the workspace again.</p><button onClick={reset} className="mt-5 rounded-full bg-stone-950 px-5 py-2 text-white">Try again</button></main>;
}
