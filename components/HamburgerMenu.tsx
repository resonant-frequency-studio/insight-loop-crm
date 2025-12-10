"use client";

interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function HamburgerMenu({ isOpen, onClick }: HamburgerMenuProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 rounded-lg"
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <div className="flex items-center justify-center gap-2 relative">
        {/* Text container with sliding animation */}
        <div className="relative w-12 h-5 overflow-hidden">
          {/* Menu text - slides up and out when opening, slides up from bottom when closing */}
          <span
            className={`absolute inset-0 text-sm font-medium text-gray-800 transition-transform duration-500 ease-in-out flex items-center justify-center ${
              isOpen ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
            }`}
          >
            Menu
          </span>
          {/* Close text - slides up from bottom when opening, slides up and out when closing */}
          <span
            className={`absolute inset-0 text-xs font-medium text-gray-800 transition-transform duration-500 ease-in-out flex items-center justify-center ${
              isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            }`}
          >
            Close
          </span>
        </div>
        
        {/* Plus/X Icon */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <svg
            className={`w-6 h-6 text-gray-800 transition-transform duration-500 ease-in-out ${
              isOpen ? "rotate-45" : "rotate-0"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
      </div>
    </button>
  );
}

