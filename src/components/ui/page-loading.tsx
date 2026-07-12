interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label }: PageLoadingProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}
