const BANKS = ['HDFC Bank', 'Axis Bank', 'Kotak', 'SBI', 'RBL', 'ICICI'];

export function BankLogos() {
  return (
    <div className="mt-16 flex w-full max-w-3xl flex-wrap items-center justify-center gap-8 opacity-40 grayscale">
      {BANKS.map((b) => (
        <span key={b} className="font-mono text-small tracking-wider">
          {b}
        </span>
      ))}
    </div>
  );
}
