export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-accent" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-muted">Loading</p>
      </div>
    </main>
  );
}
