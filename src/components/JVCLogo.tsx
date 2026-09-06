import React from "react";

interface JVCLogoProps {
  className?: string;
  size?: number;
}

export function JVCLogo({ className = "", size = 120 }: JVCLogoProps) {
  return (
    <img
      src="/jvc-logo.svg"
      alt="JVC - Junior VC Community Europe"
      width={size}
      height={(size * 1334) / 1636}
      className={`inline-block select-none ${className}`}
    />
  );
}
