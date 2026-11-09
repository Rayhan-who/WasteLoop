"use client";

import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

/**
 * Last-resort boundary when the root layout itself fails. It renders outside
 * next-intl and the stylesheet, so it shows both languages and uses inline
 * styles built from the palette values.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="bn">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#FBF8F1",
          color: "#1B2A41",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <title>{`${en.errors.genericTitle} · WasteLoop`}</title>
        <div role="alert" style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontWeight: 500 }}>{bn.errors.genericTitle}</h1>
          <p>{bn.errors.genericBody}</p>
          <h2 lang="en" style={{ fontWeight: 500 }}>
            {en.errors.genericTitle}
          </h2>
          <p lang="en">{en.errors.genericBody}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 10,
              border: 0,
              background: "#1F6B47",
              color: "#F4F1EA",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {bn.common.retry} / <span lang="en">{en.common.retry}</span>
          </button>
        </div>
      </body>
    </html>
  );
}
