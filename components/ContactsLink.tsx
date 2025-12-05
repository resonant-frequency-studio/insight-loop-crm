import Link from "next/link";

interface ContactsLinkProps {
  variant?: "default" | "error";
  className?: string;
  children?: React.ReactNode;
}

export default function ContactsLink({ 
  variant = "default", 
  className = "",
  children = "Back to Contacts"
}: ContactsLinkProps) {
  const baseClasses = "transition-colors duration-200 font-medium";
  
  const variantClasses = {
    default: "flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg",
    error: "inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg",
  };

  const iconSvg = (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );

  return (
    <Link
      href="/contacts"
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {variant !== "error" && iconSvg}
      {children}
    </Link>
  );
}

