import { Layout as SharedLayout } from "@pages/ui/Layout";
import { site } from "../../site.config";

export function Layout({
  current,
  sections = false,
  children,
}: {
  current?: string;
  sections?: boolean;
  children?: JSX.Element;
}) {
  return (
    <SharedLayout
      brand={site.brand}
      links={site.links}
      current={current}
      sections={sections ? site.sections : undefined}
    >
      {children}
    </SharedLayout>
  );
}
