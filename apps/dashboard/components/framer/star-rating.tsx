"use client";
import React from "react";

interface StarRatingProps {
  rating?: number;
  starColor?: string;
  filledColor?: string;
  starSize?: number;
  textSize?: number;
  textWeight?: number;
  textColor?: string;
  style?: React.CSSProperties;
}

export function StarRating({
  rating = 3,
  starColor = "#d3d3d3",
  filledColor = "#FFD700",
  starSize = 24,
  textSize = 16,
  textWeight = 400,
  textColor = "#000000",
  style,
}: StarRatingProps) {
  const formattedRating = Number.isInteger(rating)
    ? `${rating}.0`
    : rating.toFixed(1);

  const renderStar = (index: number) => {
    if (rating >= index + 1) {
      return (
        <svg key={index} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filledColor} width={starSize} height={starSize}>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    } else if (rating > index && rating < index + 1) {
      return (
        <svg key={index} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={starSize} height={starSize}>
          <defs>
            <linearGradient id={`half-fill-${index}`}>
              <stop offset="50%" stopColor={filledColor} />
              <stop offset="50%" stopColor={starColor} />
            </linearGradient>
          </defs>
          <path fill={`url(#half-fill-${index})`} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    }
    return (
      <svg key={index} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={starColor} width={starSize} height={starSize}>
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    );
  };

  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ fontSize: textSize, fontWeight: textWeight, color: textColor }}>
        {formattedRating}
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        {Array.from({ length: 5 }, (_, i) => renderStar(i))}
      </div>
    </div>
  );
}
