interface Props {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}

export function AmountInput({ value, onChange }: Props) {
  return (
    <div className="amount-input">
      <span className="prefix">$</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="e.g. 50"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n > 0) onChange(n);
          else onChange(undefined);
        }}
      />
    </div>
  );
}
