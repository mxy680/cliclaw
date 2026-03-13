"use client";
import React from "react";
import { colors, textStyles } from "./tokens";
import { StarRating } from "./star-rating";

interface FeedbackProps {
  name?: string;
  role?: string;
  quote?: string;
  imageSrc?: string;
  rating?: number;
}

export function Feedback({
  name = "Michael Richards",
  role = "Creative Director & Design Mentor",
  quote = '"Callum has an extraordinary talent for translating complex concepts into visually appealing and intuitive designs. Working alongside him as a mentor, I was impressed by his ability to seamlessly integrate feedback and push the boundaries of what\'s possible in digital design."',
  imageSrc,
  rating = 5,
}: FeedbackProps) {
  return (
    <div style={{
      position: "relative", width: 500, borderRadius: 10,
      padding: "40px 40px 80px 40px",
      display: "flex", flexDirection: "column", gap: 30,
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Profile Picture */}
        {imageSrc ? (
          <img src={imageSrc} alt={name} style={{
            width: 84, height: 84, borderRadius: 42, objectFit: "cover",
          }} />
        ) : (
          <div style={{
            width: 84, height: 84, borderRadius: 42,
            backgroundColor: colors.cardBg,
          }} />
        )}

        {/* Name & Position */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ ...textStyles.heading3, color: colors.white100 }}>{name}</span>
          <span style={{ ...textStyles.body15, color: colors.white100 }}>{role}</span>
        </div>

        {/* Separator */}
        <div style={{ width: "100%", height: 1, backgroundColor: colors.white100, opacity: 0.1 }} />

        {/* Quote */}
        <p style={{ ...textStyles.body18, color: colors.white100, opacity: 0.7, margin: 0 }}>
          {quote}
        </p>
      </div>

      {/* Star Rating */}
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
        <StarRating
          rating={rating}
          starColor={colors.white100}
          filledColor={colors.starColor}
          starSize={24}
          textSize={24}
          textWeight={500}
          textColor={colors.white65}
        />
      </div>
    </div>
  );
}
