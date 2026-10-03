/**
 * Implémentation Prisma du ProductRepository : c'est le seul fichier qui parle à la base.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import type { ProductChanges, ProductRepository, SupplierLink } from "./ProductRepository";

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async update(productId: string, changes: ProductChanges): Promise<void> {
    const { images, ...otherChanges } = changes;
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...otherChanges,
        ...(images !== undefined ? { images: images as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async saveSupplierRegion(productId: string, region: string, supplierId: string): Promise<void> {
    await this.prisma.productSupplier.upsert({
      where: { productId_region: { productId, region } },
      create: { productId, region, supplierId },
      update: { supplierId },
    });
  }

  async findSupplierLinks(productId: string): Promise<SupplierLink[]> {
    return this.prisma.productSupplier.findMany({
      where: { productId },
      select: { region: true, supplierId: true },
    });
  }
}
