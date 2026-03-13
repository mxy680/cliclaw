"use client";
import React, { useState } from "react";
import { colors } from "./tokens";
import { NavLink } from "./nav-link";
import { SecondaryButton } from "./secondary-button";
import { MenuIcon } from "./menu-icon";

interface NavProps {
  logoSrc?: string;
  links?: Array<{ label: string; href: string }>;
  ctaLabel?: string;
  ctaHref?: string;
}

const defaultLinks = [
  { label: "Services", href: "/#services" },
  { label: "Projects", href: "/#projects" },
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Contact", href: "https://cal.com/rick/get-rick-rolled" },
];

export function Nav({
  logoSrc = "https://framerusercontent.com/images/6tgxXoNxl1P8llnNFQNUsphYFbU.svg",
  links = defaultLinks,
  ctaLabel = "Get Template",
  ctaHref,
}: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav style={{
      width: "100%", backgroundColor: colors.navBg,
      borderRadius: 0, zIndex: 1, padding: "4px 0",
      display: "flex", justifyContent: "center", position: "relative",
    }}>
      <div style={{
        width: "100%", maxWidth: 1680, padding: "0 40px",
        display: "flex", alignItems: "center", gap: 32,
      }}>
        {/* Logo */}
        <a href="/#hero" style={{ flexShrink: 0 }}>
          {logoSrc && (
            <img src={logoSrc} alt="Logo" style={{ width: 127, height: "auto" }} />
          )}
        </a>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Desktop Nav Links */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {links.map((link) => (
            <NavLink key={link.label} label={link.label} href={link.href} />
          ))}
        </div>

        {/* CTA */}
        {ctaLabel && (
          <SecondaryButton label={ctaLabel} href={ctaHref} />
        )}

        {/* Mobile Menu Toggle (hidden on desktop by default - consumer can control visibility) */}
        <div style={{ display: "none" }}>
          <MenuIcon open={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} />
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          backgroundColor: colors.black, padding: "4px 18px 32px 18px",
          display: "flex", flexDirection: "column",
        }}>
          {links.map((link) => (
            <NavLink key={link.label} label={link.label} href={link.href} />
          ))}
        </div>
      )}
    </nav>
  );
}
