import { ResourcePage } from "@/components/marketing/resource-page";
import { insightsCards, insightsCategories as categories } from "@/lib/insights";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const activeCategory = category && categories.includes(category) ? category : categories[0];
  const query = q?.trim().toLowerCase();

  const cards = insightsCards.filter((card) => {
    const matchesCategory = activeCategory === categories[0] || card.category === activeCategory;
    const matchesQuery =
      !query ||
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  return (
    <ResourcePage
      active="Insights"
      eyebrow="Insights"
      title="Ideas and insights for hospitality performance."
      description="Real-world perspectives, strategies, and data to help you grow revenue, improve guest experience, and operate better."
      cards={cards}
      categories={categories}
      activeCategory={activeCategory}
      basePath="/resources/insights"
      searchQuery={q}
    />
  );
}
