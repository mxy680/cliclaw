"use client";
import React from "react";
import { colors, textStyles } from "./tokens";
import { SocialMediaButton } from "./social-media-button";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  logoSrc?: string;
  links?: FooterLink[];
  socials?: Array<{ href: string; icon: React.ReactNode }>;
  copyright?: string;
}

export function Footer({
  logoSrc,
  links = [],
  socials = [],
  copyright = `© ${new Date().getFullYear()} All rights reserved.`,
}: FooterProps) {
  return (
    <footer
      style={{
        width: "100%",
        padding: "40px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
      }}
    >
      {logoSrc && (
        <a href="/">
          <img src={logoSrc} alt="Logo" style={{ height: 32 }} />
        </a>
      )}

      {links.length > 0 && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ ...textStyles.body15, color: colors.white100, textDecoration: "none" }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      {socials.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {socials.map((s, i) => (
            <SocialMediaButton key={i} href={s.href} icon={s.icon} />
          ))}
        </div>
      )}

      <span style={{ ...textStyles.body15, color: colors.white65 }}>{copyright}</span>
    </footer>
  );
}
