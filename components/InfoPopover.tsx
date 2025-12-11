"use client";

import { useState, useRef, useEffect } from "react";

interface InfoPopoverProps {
  content: string;
}

export default function InfoPopover({ content }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [positionRight, setPositionRight] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !buttonRef.current || !popoverRef.current) return;

    const checkPosition = () => {
      const buttonRect = buttonRef.current!.getBoundingClientRect();
      const popoverWidth = 256; // w-64 = 16rem = 256px
      const spaceOnRight = window.innerWidth - buttonRect.right;
      const spaceOnLeft = buttonRect.left;

      // If there's not enough space on the right (less than popover width + some padding)
      // and there's more space on the left, position to the right
      if (spaceOnRight < popoverWidth + 16 && spaceOnLeft > spaceOnRight) {
        setPositionRight(true);
      } else {
        setPositionRight(false);
      }
    };

    checkPosition();
    window.addEventListener("resize", checkPosition);
    window.addEventListener("scroll", checkPosition, true);

    return () => {
      window.removeEventListener("resize", checkPosition);
      window.removeEventListener("scroll", checkPosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-card-highlight-light border border-gray-200 text-theme-darkest hover:bg-theme-medium transition-colors"
        aria-label="More information"
      >
        <span className="text-xs font-bold leading-none">i</span>
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute bottom-full mb-2 w-64 p-3 bg-card-highlight-light border border-gray-200 text-foreground text-[14px] rounded-md shadow-xl z-50 ${
            positionRight ? "right-0" : "left-0"
          }`}
        >
          <p className="leading-relaxed lowercase">{content}</p>
          <div
            className={`absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white ${
              positionRight ? "right-4" : "left-4"
            }`}
          ></div>
          <div
            className={`absolute top-full -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200 ${
              positionRight ? "right-4" : "left-4"
            }`}
          ></div>
        </div>
      )}
    </div>
  );
}

