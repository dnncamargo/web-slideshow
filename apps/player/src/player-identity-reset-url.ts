/** Consumes the one-shot identity reset query while preserving the rest of the URL. */
export function consumePlayerIdentityResetParameter(
  href: string,
  replaceUrl: (relativeUrl: string) => void,
): boolean {
  const url = new URL(href);
  if (!url.searchParams.getAll("reset").includes("1")) return false;

  url.searchParams.delete("reset");
  replaceUrl(`${url.pathname}${url.search}${url.hash}`);
  return true;
}
