export function Countdown({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        key={value}
        className="text-9xl font-bold tabular-nums animate-shake"
      >
        {value}
      </div>
      <p className="text-white/50">Get ready…</p>
    </div>
  );
}
