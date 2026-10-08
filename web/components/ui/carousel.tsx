"use client";
import useEmblaCarousel from "embla-carousel-react";
import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function Carousel({ children, label, hero = false }: { children: ReactNode; label: string; hero?: boolean }) {
  const [ref, api] = useEmblaCarousel({ align: "start", slidesToScroll: 1, containScroll: "trimSnaps", watchDrag: true });
  const [previous, setPrevious] = useState(false);
  const [next, setNext] = useState(false);
  const [index, setIndex] = useState(0);
  const update = useCallback(() => { if (api) { setPrevious(api.canScrollPrev()); setNext(api.canScrollNext()); setIndex(api.selectedScrollSnap()); } }, [api]);
  useEffect(() => { if (!api) return; update(); api.on("select", update).on("reInit", update); return () => { api.off("select", update).off("reInit", update); }; }, [api, update]);
  const jump = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const slideCount = Children.count(children);
  return <div className={`carousel${hero ? " carousel-hero" : ""}`} role="region" aria-label={label} aria-roledescription="carousel">
    <div className="carousel-viewport" ref={ref}><div className="carousel-track">{children}</div></div>
    {hero ? (
      <div className="carousel-hero-controls">
        <Button className="carousel-arrow carousel-arrow-previous" variant="outline" size="icon" aria-label={`${label}: ก่อนหน้า`} disabled={!previous} onClick={() => api?.scrollPrev(jump())}><ChevronLeft /></Button>
        <span className="sr-only" aria-live="polite">รายการที่ {index + 1}</span>
        <div className="carousel-dots" aria-label="เลือกสไลด์">
          {Array.from({ length: slideCount }, (_, slide) => <button key={slide} className="carousel-dot" type="button" aria-label={`ไปสไลด์ที่ ${slide + 1}`} aria-current={slide === index ? "true" : undefined} onClick={() => api?.scrollTo(slide, jump())} />)}
        </div>
        <Button className="carousel-arrow carousel-arrow-next" variant="outline" size="icon" aria-label={`${label}: ถัดไป`} disabled={!next} onClick={() => api?.scrollNext(jump())}><ChevronRight /></Button>
      </div>
    ) : (
      <div className="carousel-controls"><Button variant="outline" size="icon" aria-label={`${label}: ก่อนหน้า`} disabled={!previous} onClick={() => api?.scrollPrev(jump())}><ChevronLeft /></Button><span className="sr-only" aria-live="polite">รายการที่ {index + 1}</span><Button variant="outline" size="icon" aria-label={`${label}: ถัดไป`} disabled={!next} onClick={() => api?.scrollNext(jump())}><ChevronRight /></Button></div>
    )}
  </div>;
}
