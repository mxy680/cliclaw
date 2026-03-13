"use client";
import React from "react";
import { colors } from "./tokens";

interface MenuIconProps {
  open?: boolean;
  color?: string;
  onClick?: () => void;
}

export function MenuIcon({ open = false, color = colors.white100, onClick }: MenuIconProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 30, position: "relative",
        background: "none", border: "none", cursor: "pointer", padding: 0,
      }}
    >
      <div style={{
        position: "absolute", width: 20, height: 2, left: 5,
        backgroundColor: color, transition: "all 0.3s ease",
        top: open ? 14 : 10,
        transform: open ? "rotate(45deg)" : "none",
      }} />
      <div style={{
        position: "absolute", width: 20, height: 2, left: 5,
        backgroundColor: color, transition: "all 0.3s ease",
        bottom: open ? 14 : 10,
        transform: open ? "rotate(-45deg)" : "none",
      }} />
    </button>
  );
}
