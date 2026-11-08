export function Document({
  title,
  stylesheets,
  script,
  children,
}: {
  title: string;
  stylesheets: string[];
  script?: string;
  children?: JSX.Element;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        {children}
        {script ? <script type="module" src={script} /> : null}
      </body>
    </html>
  );
}
