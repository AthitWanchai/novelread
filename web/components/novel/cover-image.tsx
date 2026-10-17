"use client";

import Image from "next/image";
import { useState } from "react";

type CoverImageProps = {
  src: string;
  alt: string;
  title: string;
  category: string;
  tone: number;
  sizes: string;
  className?: string;
};

const categoryToneMap: Record<string, number> = {
  "แฟนตาซี": 0,
  "สืบสวน": 1,
  "ผจญภัย": 2,
  "รักโรแมนติก": 3,
  "วาย": 4,
  "ดราม่า": 5,
};

export function CoverImage({ src, alt, title, category, tone, sizes, className = "" }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState("");
  const resolvedTone = categoryToneMap[category] ?? (tone % 6);
  if (!src || failedSrc === src) {
    return (
      <span className={`cover-placeholder ${className}`.trim()} data-tone={resolvedTone} data-category={category} aria-hidden="true">
        <span className="cover-spine" />
        <span className="cover-foil-frame">
          <span className="cover-ornament">{category}</span>
          <span className="cover-placeholder-title">{title}</span>
          <span className="cover-placeholder-category">NOVELREAD EDITION</span>
        </span>
      </span>
    );
  }

  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized onError={() => setFailedSrc(src)} />;
}

