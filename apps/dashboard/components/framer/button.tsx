"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface ButtonProps {
  label?: string;
  href?: string;
  onClick?: () => void;
}

export function Button({ label = "Book a Call", href, onClick }: ButtonProps) {
  const handleClick = () => {
    if (href) window.open(href, "_blank");
    else onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      style={{
        position: "relative", display: "inline-flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "none", border: "none", padding: 0, cursor: "pointer",
      }}
    >
      {/* Outer glow - top right */}
      <div style={{
        position: "absolute", width: 74, height: 41, top: -7, right: -12,
        borderRadius: 21, background: "radial-gradient(ellipse, rgba(255,255,255,0.15), transparent)",
        opacity: 0.62, pointerEvents: "none",
      }} />
      {/* Border container */}
      <div style={{
        position: "relative", backgroundColor: "rgb(59, 59, 59)",
        borderRadius: 11.5, padding: 1.4, overflow: "hidden", zIndex: 2,
      }}>
        {/* Inner container */}
        <div style={{
          position: "relative", backgroundColor: colors.black,
          borderRadius: 10, padding: "8px 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", zIndex: 4,
        }}>
          {/* Inner glows */}
          <div style={{
            position: "absolute", width: 77, height: 41, bottom: -20, left: -10,
            borderRadius: 999, background: "radial-gradient(ellipse, rgba(255,255,255,0.2), transparent)",
            opacity: 0.41, pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", width: 92, height: 40, top: -20, right: -10,
            borderRadius: 999, background: "radial-gradient(ellipse, rgba(255,255,255,0.15), transparent)",
            pointerEvents: "none",
          }} />
          <span style={{ ...textStyles.body18, color: colors.white100, position: "relative", zIndex: 2 }}>
            {label}
          </span>
        </div>
      </div>
      {/* Outer glow - bottom left */}
      <div style={{
        position: "absolute", width: 58, height: 30, bottom: -5, left: -11,
        borderRadius: 999, background: "radial-gradient(ellipse, rgba(255,255,255,0.12), transparent)",
        pointerEvents: "none",
      }} />
    </button>
  );
}
