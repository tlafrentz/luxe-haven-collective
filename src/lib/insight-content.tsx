import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

export async function loadInsightContent(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const source = await readFile(
      path.join(process.cwd(), "content", "insights", `${slug}.mdx`),
      "utf8",
    );
    return source.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  } catch {
    return null;
  }
}

export function InsightBody({ source }: { source: string }) {
  const lines = source.split("\n"),
    blocks: ReactNode[] = [];
  let paragraph: string[] = [],
    list: string[] = [],
    ordered = false;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>{inline(paragraph.join(" "))}</p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const items = list.map((item, index) => (
      <li key={`${blocks.length}-${index}`}>{inline(item)}</li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`ol-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`ul-${blocks.length}`}>{items}</ul>
      ),
    );
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const listItem = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (image) {
      flushParagraph();
      flushList();
      blocks.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`img-${blocks.length}`} src={image[2]} alt={image[1]} />,
      );
    } else if (heading) {
      flushParagraph();
      flushList();
      const text = inline(heading[2]);
      blocks.push(
        heading[1].length === 1 ? (
          <h2 key={`h-${blocks.length}`}>{text}</h2>
        ) : heading[1].length === 2 ? (
          <h2 key={`h-${blocks.length}`}>{text}</h2>
        ) : (
          <h3 key={`h-${blocks.length}`}>{text}</h3>
        ),
      );
    } else if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote key={`q-${blocks.length}`}>
          {inline(line.slice(2))}
        </blockquote>,
      );
    } else if (listItem) {
      flushParagraph();
      const nextOrdered = /\d+\./.test(listItem[1]);
      if (list.length && nextOrdered !== ordered) flushList();
      ordered = nextOrdered;
      list.push(listItem[2]);
    } else paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return <>{blocks}</>;
}

function inline(value: string): ReactNode[] {
  return value
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("*") && part.endsWith("*") ? (
        <em key={index}>{part.slice(1, -1)}</em>
      ) : (
        part
      ),
    );
}
