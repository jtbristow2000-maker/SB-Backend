"use client";

import { useState } from "react";

// Renders the business's logo image in the avatar square when a logo URL is set,
// falling back to the letter avatar if there's no URL or the image fails to load.
export function BrandLogo({
  logoUrl,
  letter,
  className
}: {
  logoUrl: string;
  letter: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <span className={className} style={{ background: "#fff", overflow: "hidden" }}>
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </span>
    );
  }
  return <span className={className}>{letter}</span>;
}
