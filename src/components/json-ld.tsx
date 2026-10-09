import { stringifyJsonLd } from "@/lib/seo";

/** SSR JSON-LD in the document body so crawlers see it in the HTML. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }}
    />
  );
}
