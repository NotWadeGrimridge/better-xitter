export function isAffiliatesPathname(pathname: string): boolean {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  const segments = path.split("/").filter(Boolean);
  return segments.length === 2 && segments[1] === "affiliates";
}
