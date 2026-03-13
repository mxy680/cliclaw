"use client";
import React from "react";

interface SocialMediaButtonProps {
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function SocialMediaButton({ href, icon, onClick }: SocialMediaButtonProps) {
  const content = (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 100, padding: 8, cursor: "pointer",
    }}>
      <div style={{ width: 24, height: 23, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{content}</a>;
  }
  return <button onClick={onClick} style={{ background: "none", border: "none", padding: 0 }}>{content}</button>;
}
