import type { ReactNode } from "react";
export function SectionTitle({
  title,
  icon,
  trailing,
}: {
  title: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        {icon}
        {title}
      </h2>
      {trailing}
    </div>
  );
}
