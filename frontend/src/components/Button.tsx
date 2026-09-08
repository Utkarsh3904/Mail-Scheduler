import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export default function Button({ variant = "primary", className = "", ...rest }: Props) {
  const base = "px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50";

  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
