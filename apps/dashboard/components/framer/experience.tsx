"use client";
import React from "react";
import { colors } from "./tokens";

interface ExperienceProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Experience({ children, style }: ExperienceProps) {
  return (
    <div style={{
      backgroundColor: colors.black, borderRadius: 10,
      padding: 16, display: "flex", flexWrap: "wrap",
      alignItems: "center", gap: 48, ...style,
    }}>
      {children}
    </div>
  );
}
