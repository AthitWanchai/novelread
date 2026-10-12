"use client";

import Image from "next/image";
import { useState } from "react";

export function StoryBackdrop({ src, className = "" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`story-backdrop ${className}`.trim()} aria-hidden="true">
      {!failed && <Image src={src} alt="" fill sizes="100vw" unoptimized={/^https?:\/\//i.test(src)} onError={() => setFailed(true)} />}
      <span className="story-backdrop-shade" />
    </div>
  );
}
