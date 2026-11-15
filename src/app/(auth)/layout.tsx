export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">
            Manel<span className="text-accent">dle</span>
          </h1>
          <p className="mt-2 text-muted">Ghicește maneaua zilei 🎶</p>
        </div>
        {children}
      </div>
    </main>
  );
}
