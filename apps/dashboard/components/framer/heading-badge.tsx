"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface HeadingBadgeProps {
  label?: string;
  dotColor?: string;
}

export function HeadingBadge({ label = "100% online", dotColor = colors.white100 }: HeadingBadgeProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      backgroundColor: colors.cardBg, borderRadius: 20,
      padding: "6px 16px", width: "fit-content",
    }}>
      <div style={{
        width: 11, height: 11, borderRadius: 10,
        backgroundColor: dotColor, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 8, height: 9, borderRadius: 10,
          backgroundColor: colors.cardBg, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: 10, backgroundColor: dotColor }} />
        </div>
      </div>
      <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
    </div>
  );
}
