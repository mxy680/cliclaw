"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface NavLinkProps {
  label?: string;
  href?: string;
  onClick?: () => void;
}

export function NavLink({ label = "Link", href = "#", onClick }: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", height: 64,
        padding: "6px 12px", gap: 6, textDecoration: "none",
        ...textStyles.body15, color: colors.white100,
      }}
    >
      {label}
    </a>
  );
}
