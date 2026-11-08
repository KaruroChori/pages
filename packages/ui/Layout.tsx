import { SectionNav, type SectionLink } from "./SectionNav";
import { TopNav, type Brand, type NavLink } from "./TopNav";

export function Layout({
  brand,
  links,
  current,
  sections,
  children,
}: {
  brand: Brand;
  links: NavLink[];
  current?: string;
  sections?: SectionLink[];
  children?: JSX.Element;
}) {
  return (
    <>
      <TopNav brand={brand} links={links} current={current} />
      {sections ? <SectionNav sections={sections} /> : null}
      {children}
      <pre id="fatal" hidden />
    </>
  );
}
