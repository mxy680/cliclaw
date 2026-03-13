"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface MainSectionTagProps {
  label?: string;
  active?: boolean;
}

export function MainSectionTag({
  label = "AI auto post engagement detector",
  active = true,
}: MainSectionTagProps) {
  return (
    <div style={{
      position: "relative", display: "inline-flex",
      backgroundColor: colors.black, borderRadius: 40,
    }}>
      <div style={{
        position: "relative",
        backgroundColor: "rgba(10, 10, 10, 0.4)",
        borderRadius: 26, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10, zIndex: 2,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: 84,
          backgroundColor: active ? colors.white100 : colors.white65,
        }} />
        <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
      </div>
      {/* Border overlay */}
      <div style={{
        position: "absolute", top: -1, right: -1, bottom: -1, left: -1,
        borderRadius: 26, border: `1px solid ${colors.border}`,
        pointerEvents: "none", zIndex: 1,
      }} />
    </div>
  );
}
