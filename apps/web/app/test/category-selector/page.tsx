// Dev-only route; CategoryTestPage was never shipped — keep a minimal page so `next build` succeeds.

export default function TestCategorySelector() {
  return (
    <main className="mx-auto max-w-lg p-8 font-sans text-sm text-gray-700">
      <h1 className="mb-2 text-lg font-semibold">Category selector test</h1>
      <p>This placeholder replaces the missing <code className="rounded bg-gray-100 px-1">CategoryTestPage</code> component.</p>
    </main>
  );
}
