"use client";
import React from "react";
import { FaqSingle } from "./faq-single";

interface FaqItem {
  question: string;
  answer: string;
}

interface AllFaqsProps {
  items?: FaqItem[];
}

const defaultItems: FaqItem[] = [
  { question: "Is Framer a web builder for creative pro?", answer: "Yes, Framer is a powerful web builder designed for creative professionals." },
  { question: "Can I use custom code in Framer?", answer: "Absolutely, Framer supports custom React components and code overrides." },
  { question: "Is Framer suitable for large projects?", answer: "Yes, Framer scales well for projects of any size with its component system." },
];

export function AllFaqs({ items = defaultItems }: AllFaqsProps) {
  return (
    <div style={{ width: 560, display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((item, i) => (
        <FaqSingle key={i} question={item.question} answer={item.answer} />
      ))}
    </div>
  );
}
