export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-pattern relative flex min-h-screen items-center justify-center bg-bg-base px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, var(--brand-glow) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
