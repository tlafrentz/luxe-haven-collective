import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsightBody, loadInsightContent } from "@/lib/insight-content";
import { findInsightArticle, insightArticles } from "@/lib/insights";

export function generateStaticParams() {
  return insightArticles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const article = findInsightArticle((await params).slug);
  if (!article) return {};
  return {
    title: `${article.title} | Luxe Haven Journal`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      publishedTime: article.publishedAt,
      images: [article.ogImage],
    },
  };
}

export default async function InsightArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    article = findInsightArticle(slug),
    source = await loadInsightContent(slug);
  if (!article || !source) notFound();
  return (
    <main className="bg-[#fffdf9] pb-20">
      <header className="border-b">
        <div className="container-shell py-10">
          <nav className="text-xs text-stone-500">
            <Link href="/resources">Resources</Link>
            <span className="mx-2">›</span>
            <Link href="/resources/insights">Insights</Link>
          </nav>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            {article.category}
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">
            {article.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            {article.description}
          </p>
          <p className="mt-5 text-sm text-stone-500">
            Luxe Haven Collective · {article.meta}
          </p>
        </div>
      </header>
      <div className="container-shell py-10">
        <div className="relative aspect-[16/7] overflow-hidden rounded-2xl">
          <Image
            src={article.image}
            alt={article.heroAlt}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 1200px"
          />
        </div>
        <article className="journal-prose mx-auto mt-12 max-w-3xl">
          <InsightBody source={source} />
        </article>
      </div>
    </main>
  );
}
