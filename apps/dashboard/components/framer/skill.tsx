"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface SkillProps {
  label?: string;
}

export function Skill({ label = "UX Design" }: SkillProps) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      backgroundColor: colors.cardBg, borderRadius: 8,
      padding: "10px 12px",
    }}>
      <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
    </div>
  );
}
