"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface StatCardProps {
  value?: string;
  description?: string;
}

export function StatCard({
  value = "300+",
  description = "people guided toward greater emotional balance.",
}: StatCardProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ ...textStyles.heading3, color: colors.white100 }}>{value}</span>
      <span style={{ ...textStyles.bodyLarge, color: colors.white100, opacity: 0.7 }}>{description}</span>
    </div>
  );
}
