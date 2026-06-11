export function BeaverLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BOBR beaver mascot"
    >
      {/* Body */}
      <ellipse cx="32" cy="38" rx="18" ry="14" fill="#8B5E3C" />
      {/* Head */}
      <ellipse cx="32" cy="22" rx="14" ry="13" fill="#A0714F" />
      {/* Ears */}
      <ellipse cx="21" cy="12" rx="5" ry="6" fill="#8B5E3C" />
      <ellipse cx="43" cy="12" rx="5" ry="6" fill="#8B5E3C" />
      <ellipse cx="21" cy="12" rx="3" ry="4" fill="#C49A6C" />
      <ellipse cx="43" cy="12" rx="3" ry="4" fill="#C49A6C" />
      {/* Eyes */}
      <circle cx="26" cy="20" r="3.5" fill="white" />
      <circle cx="38" cy="20" r="3.5" fill="white" />
      <circle cx="27" cy="20" r="2" fill="#2C1A0E" />
      <circle cx="39" cy="20" r="2" fill="#2C1A0E" />
      <circle cx="27.7" cy="19.3" r="0.7" fill="white" />
      <circle cx="39.7" cy="19.3" r="0.7" fill="white" />
      {/* Nose */}
      <ellipse cx="32" cy="27" rx="3" ry="2" fill="#5C3317" />
      {/* Teeth */}
      <rect x="29" y="29" width="3" height="4" rx="1" fill="white" />
      <rect x="33" y="29" width="3" height="4" rx="1" fill="white" />
      {/* Whiskers */}
      <line x1="32" y1="28" x2="18" y2="25" stroke="#5C3317" strokeWidth="0.8" />
      <line x1="32" y1="29" x2="18" y2="30" stroke="#5C3317" strokeWidth="0.8" />
      <line x1="32" y1="28" x2="46" y2="25" stroke="#5C3317" strokeWidth="0.8" />
      <line x1="32" y1="29" x2="46" y2="30" stroke="#5C3317" strokeWidth="0.8" />
      {/* Tail */}
      <ellipse cx="32" cy="52" rx="14" ry="6" fill="#5C3317" />
      {/* Tail pattern */}
      <ellipse cx="32" cy="52" rx="11" ry="4" fill="#6B3D1E" />
      <line x1="21" y1="52" x2="43" y2="52" stroke="#5C3317" strokeWidth="1" />
      <line x1="24" y1="48" x2="24" y2="56" stroke="#5C3317" strokeWidth="1" />
      <line x1="32" y1="47" x2="32" y2="57" stroke="#5C3317" strokeWidth="1" />
      <line x1="40" y1="48" x2="40" y2="56" stroke="#5C3317" strokeWidth="1" />
    </svg>
  );
}
