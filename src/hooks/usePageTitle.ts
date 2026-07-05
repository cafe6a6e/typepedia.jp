import { useEffect } from "react";

const SITE = "Typepedia";

/** Set document.title for a page, suffixed with the site name. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : SITE;
  }, [title]);
}
