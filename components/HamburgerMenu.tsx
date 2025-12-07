"use client";

interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function HamburgerMenu({ isOpen, onClick }: HamburgerMenuProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed top-4 right-4 z-60 p-2 rounded-lg bg-[#212B36] text-white hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-lg"
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <div className="w-6 h-6 flex flex-col justify-center items-center gap-1.5">
        <span
          className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
            isOpen ? "rotate-45 translate-y-2" : ""
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
            isOpen ? "opacity-0" : ""
          }`}
        />
        <span
          className={`block h-0.5 w-6 bg-current transition-all duration-300 ${
            isOpen ? "-rotate-45 -translate-y-2" : ""
          }`}
        />
      </div>
    </button>
  );
}

