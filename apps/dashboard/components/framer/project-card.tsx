"use client";
import React from "react";
import { colors, textStyles } from "./tokens";

interface ProjectCardProps {
  imageSrc?: string;
  href?: string;
  label?: string;
}

export function ProjectCard({
  imageSrc,
  href = "#",
  label = "View Casestudy",
}: ProjectCardProps) {
  return (
    <a href={href} style={{ textDecoration: "none", display: "block" }}>
      <div style={{
        position: "relative", width: 366, height: 343,
        borderRadius: 4, overflow: "hidden",
      }}>
        {/* Background Image */}
        {imageSrc ? (
          <img src={imageSrc} alt="" style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            width: "100%", height: "100%", objectFit: "cover",
          }} />
        ) : (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: colors.cardBg,
          }} />
        )}

        {/* Overlay Button */}
        <div style={{
          position: "absolute", right: 8, bottom: 10, left: 8,
          backgroundColor: "rgba(99, 99, 99, 0.3)",
          borderRadius: 40, padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          zIndex: 2,
        }}>
          <span style={{ ...textStyles.body15, color: colors.white100 }}>{label}</span>
          <div style={{ width: 25, height: 25, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={20} height={20} viewBox="0 0 256 256" fill="none">
              <line x1="64" y1="192" x2="192" y2="64" stroke={colors.white100} strokeWidth="16" strokeLinecap="round" />
              <polyline points="88,64 192,64 192,168" fill="none" stroke={colors.white100} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </a>
  );
}
