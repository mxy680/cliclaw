"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface ProcessProps {
  step?: number;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function Process({
  step = 1,
  title = "Choose Your Plan",
  description = "Find the perfect plan tailored to your needs, offering the right balance of features, flexibility, and value to help you achieve your goals effortlessly.",
  icon,
}: ProcessProps) {
  return (
    <div style={{
      position: "relative", width: 350,
      backgroundColor: colors.cardBg, borderRadius: 30,
      padding: "44px 32px 32px 32px",
      display: "flex", flexDirection: "column", gap: 24,
    }}>
      {/* Step Badge */}
      <div style={{
        position: "absolute", top: 10, right: 13,
        width: 34, height: 34, borderRadius: 100,
        backgroundColor: colors.cardBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1, ...textStyles.body15, color: colors.white100,
      }}>
        {step}
      </div>

      {icon && <div style={{ width: 30, height: 29 }}>{icon}</div>}

      <span style={{ ...textStyles.heading3, color: colors.white100 }}>{title}</span>

      <div style={{ width: "100%", height: 1, backgroundColor: colors.white100, opacity: 0.1 }} />

      <p style={{ ...textStyles.body15, color: colors.white100, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}
