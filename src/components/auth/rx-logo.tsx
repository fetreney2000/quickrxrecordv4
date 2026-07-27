import { useNavigate } from "react-router-dom";

export function RxLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size * 2.5}
      height={size}
      viewBox="0 0 100 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="40" rx="8" fill="url(#rx-gradient)" />
      <defs>
        <linearGradient id="rx-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1877f2" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}