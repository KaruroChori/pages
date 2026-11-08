export type Brand = {
  label: string;
  href: string;
  logo?: string;
};

export type NavLink = {
  id: string;
  href: string;
  label: string;
};

export function TopNav({
  brand,
  links,
  current,
}: {
  brand: Brand;
  links: NavLink[];
  current?: string;
}) {
  return (
    <nav className="topnav">
      <a className="brand" href={brand.href}>
        {brand.logo ? <img className="logo" src={brand.logo} alt="" /> : null}
        <span>{brand.label}</span>
      </a>
      <div className="topnav-links">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            aria-current={link.id === current ? "page" : undefined}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
