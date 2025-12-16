import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg" | "xl" | "responsive";
  hover?: boolean;
}

export default function Card({ 
  children, 
  className = "", 
  padding = "md",
  hover = false 
}: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-3",
    md: "p-6",
    lg: "p-8",
    xl: "p-12",
    responsive: "p-3 xl:p-6",
  };

  const baseClasses = "bg-card-light rounded-sm shadow-sm border border-theme-lighter";
  const paddingClass = padding === "none" || className.includes("p-") ? "" : paddingClasses[padding];
  const hoverClasses = hover ? "hover:shadow-[0px_6px_16px_rgba(0,0,0,0.15)] transition-shadow duration-200" : "";

  return (
    <div className={`${baseClasses} ${paddingClass} ${hoverClasses} ${className}`.trim()}>
      {children}
    </div>
  );
}

