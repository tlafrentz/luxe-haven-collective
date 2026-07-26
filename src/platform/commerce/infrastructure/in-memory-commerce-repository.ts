import type { CommerceOffer, CommercePrice, CommerceProduct } from "../domain";
import type { CommerceCatalogRepository } from "../application";

export class InMemoryCommerceCatalogRepository implements CommerceCatalogRepository {
  constructor(private products: readonly CommerceProduct[] = [], private prices: readonly CommercePrice[] = [], private offers: readonly CommerceOffer[] = []) {}
  async listProducts() { return this.products; }
  async listPrices() { return this.prices; }
  async listOffers() { return this.offers; }
  async getProduct(idOrSlug: string) { return this.products.find(value => value.id === idOrSlug || value.slug === idOrSlug) ?? null; }
}
