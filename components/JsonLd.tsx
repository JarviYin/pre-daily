// Renders a schema.org JSON-LD block. The `<` → < escape prevents any
// string value (LLM summaries, Polymarket titles) from breaking out of the
// <script> with a literal </script>.
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
