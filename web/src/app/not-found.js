import { Button } from "@/components/shared";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">404</p>
        <h1 className="mt-3 text-4xl font-black">Page not found</h1>
        <p className="mt-4 text-muted">This route is not part of the current booking platform surface.</p>
        <Button href="/" className="mt-6">Return Home</Button>
      </div>
    </main>
  );
}
