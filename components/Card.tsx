import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return <section className={`soft-card p-5 ${className}`}>{children}</section>;
}
