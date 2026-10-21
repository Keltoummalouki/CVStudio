import { SectionNav } from "@/features/career-data/components/section-nav";

export default function CareerDataLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="xl:grid xl:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="min-w-0 border-b bg-card/60 xl:border-r xl:border-b-0">
        <SectionNav className="xl:sticky xl:top-0 xl:px-3 xl:py-8" />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
