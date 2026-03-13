"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface SecondaryButtonProps {
  label?: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function SecondaryButton({
  label = "Remix for free",
  href,
  icon,
  onClick,
}: SecondaryButtonProps) {
  const content = (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 120, padding: "10px 20px", gap: 6,
      cursor: "pointer",
    }}>
      {icon && <div style={{ opacity: 0.6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>}
      <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a>;
  }
  return <button onClick={onClick} style={{ background: "none", border: "none", padding: 0 }}>{content}</button>;
}
