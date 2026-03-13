"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface ServiceProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function Service({
  title = "Mockup Design",
  description = "Designing breathtaking, user-centric websites that boost engagement, conversions, and growth, perfectly aligned with your brand",
  icon,
}: ServiceProps) {
  return (
    <div style={{
      width: 374, backgroundColor: colors.cardBg,
      borderRadius: 20, padding: 30,
      display: "flex", flexDirection: "column", gap: 32,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10 }}>
          {icon && <div style={{ width: 30, height: 30, flexShrink: 0 }}>{icon}</div>}
          <span style={{ ...textStyles.heading4, color: colors.white100, flex: 1, minWidth: 184 }}>
            {title}
          </span>
        </div>
        <div style={{ width: "100%", height: 1, backgroundColor: colors.white100, opacity: 0.1 }} />
        <p style={{ ...textStyles.body15, color: colors.white100, margin: 0 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
