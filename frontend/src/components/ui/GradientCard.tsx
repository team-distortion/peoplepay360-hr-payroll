import React, { useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GradientCard({ children, className = "", ...props }: GradientCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.style.setProperty("--border-opacity", "1");
  }

  function handleMouseLeave() {
    ref.current?.style.setProperty("--border-opacity", "0");
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "gradient-border-card relative rounded-2xl bg-card border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out",
        className
      )}
      {...props}
    >
      <div className="relative h-full z-10">{children}</div>

      <style>{`
        .gradient-border-card {
          --x: 50%;
          --y: 50%;
          --border-opacity: 0;
        }
        .gradient-border-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: radial-gradient(
            220px circle at var(--x) var(--y),
            var(--brand-accent),
            var(--gradient-end) 60%,
            transparent 80%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: var(--border-opacity);
          transition: opacity 300ms ease;
          pointer-events: none;
          z-index: 20;
        }
      `}</style>
    </div>
  );
}
