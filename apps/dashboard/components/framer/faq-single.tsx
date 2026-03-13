"use client";
import React, { useState } from "react";
import { colors, textStyles } from "./tokens";

interface FaqSingleProps {
  question?: string;
  answer?: string;
  defaultOpen?: boolean;
}

export function FaqSingle({
  question = "Is Framer a web builder for creative pro?",
  answer = "Yes, Framer is a powerful web builder designed for creative professionals, offering advanced design tools and interactive capabilities.",
  defaultOpen = false,
}: FaqSingleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        backgroundColor: colors.cardBg, borderRadius: 15,
        padding: open ? "0 20px 20px 10px" : "0 20px 0 10px",
        cursor: "pointer", overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 25,
        padding: 20,
      }}>
        <span style={{ ...textStyles.body18, color: colors.white100, flex: 1 }}>
          {question}
        </span>
        <svg
          width={15}
          height={15}
          viewBox="0 0 256 256"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(45deg)" : "none",
            transition: "transform 0.3s ease",
          }}
        >
          <line x1="128" y1="40" x2="128" y2="216" stroke={colors.white100} strokeWidth="24" strokeLinecap="round" />
          <line x1="40" y1="128" x2="216" y2="128" stroke={colors.white100} strokeWidth="24" strokeLinecap="round" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: "0 20px 0 20px" }}>
          <p style={{ ...textStyles.body18, color: colors.white100, opacity: 0.7, margin: 0 }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}
