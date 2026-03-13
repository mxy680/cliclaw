"use client";
import React from "react";

interface OnOffIndicatorProps {
  on?: boolean;
  color?: string;
  inactiveColor?: string;
  size?: number;
}

export function OnOffIndicator({
  on = true,
  color = "rgb(255, 255, 255)",
  inactiveColor = "rgba(255, 255, 255, 0.65)",
  size = 5,
}: OnOffIndicatorProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 84,
      backgroundColor: on ? color : inactiveColor,
    }} />
  );
}
