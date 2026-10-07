"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/novel/cover-image";
import { Entrance } from "@/components/ui/entrance";
import { coverUrl, slugify, type Novel } from "@/lib/api/novels";

export function SpotlightCarousel({ novels }: { novels: Novel[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  function showPrevious() {
    setActiveIndex(index => Math.max(0, index - 1));
  }

  function showNext() {
    setActiveIndex(index => Math.min(novels.length - 1, index + 1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  }

  return (
    <Entrance as="section" className="home-spotlight" aria-label="เรื่องแนะนำ" aria-roledescription="carousel" onKeyDown={handleKeyDown}>
      <div className="spotlight-heading">
        <div><span className="section-kicker">NOVELREAD PICKS</span><h1>เรื่องเด่นที่อยากให้ลองอ่าน</h1></div>
        <div className="spotlight-controls">
          <span className="spotlight-count" aria-live="polite">{activeIndex + 1} / {novels.length}</span>
          <button className="spotlight-arrow" type="button" aria-label="เรื่องก่อนหน้า" onClick={showPrevious} disabled={activeIndex === 0}><ChevronLeft aria-hidden="true" /></button>
          <button className="spotlight-arrow" type="button" aria-label="เรื่องถัดไป" onClick={showNext} disabled={activeIndex === novels.length - 1}><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
      <div className="spotlight-window">
        <div className="spotlight-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }} aria-live="polite">
          {novels.map((novel, index) => (
            <Link className={`spotlight-card spotlight-tone-${index % 3}`} href={`/novel/${novel.id}/${slugify(novel.title)}`} key={novel.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} จาก ${novels.length}: ${novel.title}`} aria-hidden={index !== activeIndex} tabIndex={index === activeIndex ? 0 : -1}>
              <span className="spotlight-copy">
                <Badge variant="secondary" className="spotlight-category">{novel.category}</Badge>
                <strong>{novel.title}</strong>
                <span className="spotlight-author">โดย {novel.pen_name}</span>
                <span className="spotlight-action">เริ่มอ่าน <span aria-hidden="true">↗</span></span>
              </span>
              <span className="spotlight-cover"><CoverImage src={coverUrl(novel.cover)} alt={`ปกเรื่อง ${novel.title}`} title={novel.title} category={novel.category} tone={novel.id % 4} sizes="(max-width: 740px) 35vw, 220px" /></span>
            </Link>
          ))}
        </div>
      </div>
      <div className="spotlight-dots" aria-label="เลือกเรื่องแนะนำ">
        {novels.map((novel, index) => <button key={novel.id} type="button" className={index === activeIndex ? "spotlight-dot is-active" : "spotlight-dot"} aria-label={`ไปเรื่องที่ ${index + 1}: ${novel.title}`} aria-current={index === activeIndex ? "true" : undefined} onClick={() => setActiveIndex(index)} />)}
      </div>
    </Entrance>
  );
}
