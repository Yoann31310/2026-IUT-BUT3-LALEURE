/**
 * Persistance des produits.
 * Product ne connaît que cette interface : il ne sait pas quelle base est utilisée.
 */
import type { ProductStatus } from "./Product";

export interface ProductChanges {
  images?: Record<string, string>;
  discounts?: string[];
  priceMargin?: number;
  stock?: number;
  quantity?: number;
  status?: ProductStatus;
  updatedAt: Date;
}

export interface SupplierLink {
  region: string;
  supplierId: string;
}

export interface ProductRepository {
  update(productId: string, changes: ProductChanges): Promise<void>;
  saveSupplierRegion(productId: string, region: string, supplierId: string): Promise<void>;
  findSupplierLinks(productId: string): Promise<SupplierLink[]>;
}

/** Repository en mémoire : utilisé par défaut et dans les tests (aucune base de données). */
export class InMemoryProductRepository implements ProductRepository {
  readonly updates: { productId: string; changes: ProductChanges }[] = [];
  private readonly supplierLinks = new Map<string, SupplierLink[]>();

  async update(productId: string, changes: ProductChanges): Promise<void> {
    this.updates.push({ productId, changes });
  }

  async saveSupplierRegion(productId: string, region: string, supplierId: string): Promise<void> {
    const links = (this.supplierLinks.get(productId) ?? []).filter((link) => link.region !== region);
    links.push({ region, supplierId });
    this.supplierLinks.set(productId, links);
  }

  async findSupplierLinks(productId: string): Promise<SupplierLink[]> {
    return [...(this.supplierLinks.get(productId) ?? [])];
  }
}
