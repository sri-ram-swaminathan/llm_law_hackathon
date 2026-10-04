export function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-xl">{title}</h1>
      {note && <p className="mt-1 text-text-2">{note}</p>}
    </div>
  );
}
