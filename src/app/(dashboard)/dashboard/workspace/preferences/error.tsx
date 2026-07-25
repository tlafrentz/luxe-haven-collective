"use client";
export default function ErrorState({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Preferences could not be loaded</h1><p className="mt-2">Organization and property defaults were not changed.</p><button onClick={reset} className="mt-5 rounded-full bg-stone-950 px-5 py-2 text-white">Try again</button></main>; }
