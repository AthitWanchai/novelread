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

export function CoverImage({ src, alt, title, category, tone, sizes, className = "" }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState("");
  if (!src || failedSrc === src) {
    return <span className={`cover-placeholder ${className}`.trim()} data-tone={tone} aria-hidden="true">
      <span className="cover-placeholder-title">{title}</span>
      <span className="cover-placeholder-category">{category}</span>
    </span>;
  }

  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized onError={() => setFailedSrc(src)} />;
}
