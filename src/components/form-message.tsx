export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p role={error ? 'alert' : 'status'} className={error ? 'text-sm font-medium text-bad' : 'text-sm text-muted'}>
      {error ?? message}
    </p>
  );
}
