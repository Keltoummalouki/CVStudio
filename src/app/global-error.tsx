"use client";

import "./globals.css";

// Replaces the root layout when it fails, so no translations or providers are
// available. The message is shown in both supported languages.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 font-sans text-foreground">
        <title>CVStudio</title>
        <main className="w-full max-w-md space-y-5 rounded-lg border bg-card p-6">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              Your saved data is safe. Please try again.
            </p>
          </div>
          <div lang="fr" className="space-y-2 border-t pt-4">
            <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground">
              Vos données enregistrées sont en sécurité. Veuillez réessayer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground"
          >
            Try again · Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
