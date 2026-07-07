import type { Property } from "@/types/database";

export const featuredProperties: Property[] = [
  {
    id: "mesa-retreat",
    owner_id: null,
    name: "Mesa Downtown Retreat",
    slug: "mesa-downtown-retreat",
    description: "A polished desert stay with boutique hotel touches, two queen bedrooms, curated amenities, and easy access to Mesa, Tempe, and Phoenix attractions.",
    city: "Mesa",
    state: "AZ",
    bedrooms: 2,
    bathrooms: 1,
    max_guests: 4,
    nightly_rate: 168,
    amenities: ["Fast Wi-Fi", "Self check-in", "Fully stocked kitchen", "Workspace"],
    images: ["https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=1400&auto=format&fit=crop"],
    status: "active"
  },
  {
    id: "desert-casita",
    owner_id: null,
    name: "Desert Casita Haven",
    slug: "desert-casita-haven",
    description: "Warm neutrals, thoughtful design, and an effortless stay experience for leisure travelers, remote workers, and weekend escapes.",
    city: "Scottsdale",
    state: "AZ",
    bedrooms: 1,
    bathrooms: 1,
    max_guests: 2,
    nightly_rate: 215,
    amenities: ["Pool access", "Smart TV", "Premium linens", "Coffee bar"],
    images: ["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1400&auto=format&fit=crop"],
    status: "active"
  },
  {
    id: "urban-haven",
    owner_id: null,
    name: "Urban Haven Suite",
    slug: "urban-haven-suite",
    description: "A refined city base designed for seamless arrivals, restful evenings, and guest-ready hospitality from the first message to checkout.",
    city: "Phoenix",
    state: "AZ",
    bedrooms: 2,
    bathrooms: 2,
    max_guests: 5,
    nightly_rate: 245,
    amenities: ["Garage parking", "Balcony", "In-unit laundry", "Gym access"],
    images: ["https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1400&auto=format&fit=crop"],
    status: "active"
  }
];

export function getPropertyBySlug(slug: string) {
  return featuredProperties.find((property) => property.slug === slug);
}
