"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface SmallBadgeCardProps {
  label?: string;
  icon?: React.ReactNode;
}

export function SmallBadgeCard({ label = "Video & Motion Graphics", icon }: SmallBadgeCardProps) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      backgroundColor: colors.cardBg, borderRadius: 78,
      padding: "14px 16px",
    }}>
      {icon && <div style={{ width: 20, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>}
      <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
    </div>
  );
}
