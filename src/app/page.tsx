export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-24 text-zinc-50">
      <main className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-400">
          Launch 26 Hackathon
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Relic Ring Protocol
        </h1>
        <p className="text-lg leading-8 text-zinc-400">
          Interplanetary laser/fiber network simulator with physics-based
          latency, alien number systems, and fault-tolerant routing.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm text-zinc-500">
          <span className="rounded-full border border-zinc-800 px-3 py-1">
            Next.js
          </span>
          <span className="rounded-full border border-zinc-800 px-3 py-1">
            Vercel
          </span>
          <span className="rounded-full border border-zinc-800 px-3 py-1">
            Supabase
          </span>
        </div>
      </main>
    </div>
  );
}
