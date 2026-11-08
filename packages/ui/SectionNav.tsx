export type SectionLink = {
  href: string;
  label: string;
};

export function SectionNav({
  sections,
  label = "On this page",
}: {
  sections: SectionLink[];
  label?: string;
}) {
  return (
    <nav className="section-nav" aria-label={label}>
      <span>{label}</span>
      {sections.map((section) => (
        <a key={section.href} href={section.href}>
          {section.label}
        </a>
      ))}
    </nav>
  );
}
