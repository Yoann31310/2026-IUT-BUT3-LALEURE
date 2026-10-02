/**
 * Modèle de domaine Product — Gestion des produits, stocks, prix et remises.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export class InsufficientStockError extends Error {
  constructor(message = "Not enough stock") {
    super(message);
    this.name = "InsufficientStockError";
  }
}
export class MaxDiscountsExceededError extends Error {
  constructor(message = "Cannot have more than 2 discounts at the same time") {
    super(message);
    this.name = "MaxDiscountsExceededError";
  }
}
export class InvalidDiscountDateError extends Error {
  constructor(message = "validUntil cannot be in the past") {
    super(message);
    this.name = "InvalidDiscountDateError";
  }
}
export class SupplierNotFoundError extends Error {
  constructor(region: string) {
    super("No supplier found for region " + region);
    this.name = "SupplierNotFoundError";
  }
}
export class MalformedSupplierEmailError extends Error {
  constructor(supplierName: string, email: string) {
    super("Supplier " + supplierName + " has a malformed email: " + email);
    this.name = "MalformedSupplierEmailError";
  }
}
export class InvalidImageUrlError extends Error {
  constructor(message = "url must start with http") {
    super(message);
    this.name = "InvalidImageUrlError";
  }
}

export type Channel = "email" | "sms" | "push";
export type Chnl = Channel;

export type ProductStatus = "active" | "out_of_stock" | "deprecated";
export type PrdStat = ProductStatus;

export interface Notification {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  channel: Channel;
  sentAt: Date;
  productId?: string;
  // Backward compatibility aliases
  recip?: string;
  subj?: string;
  bod?: string;
  chnl?: Channel;
  prdId?: string;
}

export class Supplier {
  public static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public region: string,
  ) {}

  get nm(): string { return this.name; }
  set nm(v: string) { this.name = v; }
  get eml(): string { return this.email; }
  set eml(v: string) { this.email = v; }
  get rgn(): string { return this.region; }
  set rgn(v: string) { this.region = v; }
}

export class Warehouse {
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public region: string,
  ) {}

  get nm(): string { return this.name; }
  set nm(v: string) { this.name = v; }
  get rgn(): string { return this.region; }
  set rgn(v: string) { this.region = v; }
}

export const DEFAULT_MARGIN_PERCENT = 15;
export const DEFAULT_VAT_PERCENT = 20;
export const MAX_DISCOUNTS_COUNT = 2;
export class Price {
  amount: number;
  currency: string;
  margin: number; // percentage
  vat: number; // percentage, applied on margin only

  constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
    this.margin = DEFAULT_MARGIN_PERCENT;
    this.vat = DEFAULT_VAT_PERCENT;
  }

  get amt(): number { return this.amount; }
  set amt(v: number) { this.amount = v; }
  get ccy(): string { return this.currency; }
  set ccy(v: string) { this.currency = v; }
  get mgn(): number { return this.margin; }
  set mgn(v: number) { this.margin = v; }

  getResellerPrice(): number {
    const mgnAmt = (this.amount * this.margin) / 100;
    const vatAmt = (mgnAmt * this.vat) / 100;
    return this.amount + mgnAmt + vatAmt;
  }

}

export class Product {
  id: string;
  name: string;
  slug: string;
  price: Price;
  discounts: string[];
  images: Record<string, string>; // key = context ("thumbnail", "hero", ...), value = url
  suppliersRegions: Map<string, Supplier>; // key = region
  weight: number;
  dimensions: string;
  quantity: number;
  stock: number;
  warehouse: Warehouse | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  notifications: Notification[] = [];
  validUntil: Date | null = null;

  constructor(
    id: string,
    name: string,
    slug: string,
    price: Price,
    discounts: string[],
    images: Record<string, string>,
    suppliersRegions: Map<string, Supplier>,
    weight: number,
    dimensions: string,
    quantity: number,
    stock: number,
    warehouse: Warehouse | null,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.price = price;
    this.discounts = discounts;
    this.images = images;
    this.suppliersRegions = suppliersRegions;
    this.weight = weight;
    this.dimensions = dimensions;
    this.quantity = quantity;
    this.stock = stock;
    this.warehouse = warehouse;
    this.status = "active";
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // Backward compatibility getters / setters
  get nm(): string { return this.name; }
  set nm(v: string) { this.name = v; }
  get slg(): string { return this.slug; }
  set slg(v: string) { this.slug = v; }
  get dscs(): string[] { return this.discounts; }
  set dscs(v: string[]) { this.discounts = v; }
  get imgs(): Record<string, string> { return this.images; }
  set imgs(v: Record<string, string>) { this.images = v; }
  get splrRgns(): Map<string, Supplier> { return this.suppliersRegions; }
  set splrRgns(v: Map<string, Supplier>) { this.suppliersRegions = v; }
  get wgt(): number { return this.weight; }
  set wgt(v: number) { this.weight = v; }
  get dims(): string { return this.dimensions; }
  set dims(v: string) { this.dimensions = v; }
  get qty(): number { return this.quantity; }
  set qty(v: number) { this.quantity = v; }
  get stk(): number { return this.stock; }
  set stk(v: number) { this.stock = v; }
  get wh(): Warehouse | null { return this.warehouse; }
  set wh(v: Warehouse | null) { this.warehouse = v; }
  get stat(): ProductStatus { return this.status; }
  set stat(v: ProductStatus) { this.status = v; }
  get notifs(): Notification[] { return this.notifications; }
  set notifs(v: Notification[]) { this.notifications = v; }

  getDisplayLabel(): string {
    if (this.status === "deprecated") {
      return `[DISCONTINUED] ${this.name}`;
    }
    if (this.stock === 0) {
      return `[OUT OF STOCK] ${this.name}`;
    }
    return this.name;
  }

  // --- Catalog / images / discounts ---

  async addImage(ctx: string, url: string): Promise<void> {
    if (!this.isValidHttpUrl(url)) {
      throw new InvalidImageUrlError();
    }

    if (this.images[ctx] === undefined) {
      this.images[ctx] = url;
      this.updatedAt = new Date();
      await prisma.product.update({
        where: { id: this.id },
        data: { images: this.images as Prisma.InputJsonValue, updatedAt: this.updatedAt },
      });
      return;
    }

    const targetKey = this.resolveImageKey(ctx);

    this.images[targetKey] = url;
    this.updatedAt = new Date();
    await prisma.product.update({
      where: { id: this.id },
      data: { images: this.images as Prisma.InputJsonValue, updatedAt: this.updatedAt },
    });
  }

  /**
   * Smell 17: Explicit fallback policy for image context resolution:
   * 1. Primary: Disambiguate using supplier name if region is present and email is valid.
   *    Reject loudly if email format is invalid.
   * 2. Fallback 1: If supplier has region but lacks email, suffix with '-supplier'.
   * 3. Fallback 2: If supplier lacks region, disambiguate using warehouse name if available.
   * 4. Fallback 3: If no supplier or warehouse details exist, preserve the base context key.
   */
  private resolveImageKey(ctx: string): string {
    let targetKey = ctx;
    for (const [, s] of this.suppliersRegions) {
      if (s.region) {
        if (s.email) {
          if (!Supplier.EMAIL_REGEX.test(s.email)) {
            throw new MalformedSupplierEmailError(s.name, s.email);
          }
          targetKey = `${ctx}-${s.name}`;
        } else {
          targetKey = `${ctx}-supplier`;
        }
      } else {
        targetKey = this.warehouse ? `${ctx}-${this.warehouse.name}` : ctx;
      }
      break;
    }
    return targetKey;
  }

  private isValidHttpUrl(urlString: string): boolean {
    if (!urlString) return false;
    try {
      const parsed = new URL(urlString);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  getValidUntil(): Date | null {
    return this.validUntil;
  }

  setValidUntil(validUntil: Date | null): void {
    this.validUntil = validUntil;
  }

  // Smell 11: Artificial spin-delay removed to avoid flaky date races against system clock
  async addDiscount(dscCode: string, validUntil: Date): Promise<void> {
    if (validUntil < new Date()) {
      throw new InvalidDiscountDateError();
    }
    if (this.discounts.length >= MAX_DISCOUNTS_COUNT) {
      throw new MaxDiscountsExceededError();
    }
    this.discounts.push(dscCode);
    this.setValidUntil(validUntil);
    this.updatedAt = new Date();
    // Smell 15: Await floating Prisma promise to ensure persistence completes and errors are caught
    await prisma.product.update({
      where: { id: this.id },
      data: { discounts: this.discounts, updatedAt: this.updatedAt },
    });
  }

  // --- Suppliers ---

  async addSupplierToRegion(region: string, suppliers: Supplier[]): Promise<void> {
    const s = suppliers.find((x) => x.region === region);
    if (!s) throw new SupplierNotFoundError(region);

    this.suppliersRegions.set(region, s);
    this.updatedAt = new Date();

    await prisma.productSupplier.upsert({
      where: { productId_region: { productId: this.id, region: region } },
      create: { productId: this.id, region: region, supplierId: s.id },
      update: { supplierId: s.id },
    });
  }

  // --- Pricing ---

  getResellerPrice(): number {
    return this.price.getResellerPrice();
  }

  async setMargin(mgnPct: number): Promise<void> {
    this.price.margin = mgnPct;
    this.updatedAt = new Date();
    await prisma.product.update({
      where: { id: this.id },
      data: { priceMargin: mgnPct, updatedAt: this.updatedAt },
    });
  }

  // --- Stock ---

  async receiveStock(qty: number): Promise<void> {
    this.stock += qty;
    this.quantity += qty;
    this.updatedAt = new Date();
    const whName = this.warehouse ? " at " + this.warehouse.name : "";
    console.log("Restocking " + this.name + whName);
    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, quantity: this.quantity, updatedAt: this.updatedAt },
    });
  }

  async sell(qty: number): Promise<void> {
    if (this.stock < qty) throw new InsufficientStockError();

    this.stock -= qty;
    this.updatedAt = new Date();

    if (this.stock === 0) {
      this.status = "out_of_stock";
    }

    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, status: this.status, updatedAt: this.updatedAt },
    });

    // Notify all regional suppliers
    this.notifyRegionalSuppliers(
      `Product sold: ${this.name}`,
      `${qty} unit(s) of ${this.name} were sold. Remaining stock: ${this.stock}.`
    );
  }

  // --- Lifecycle ---

  async deprecate(): Promise<void> {
    this.status = "deprecated";
    this.stock = 0;
    this.updatedAt = new Date();

    await prisma.product.update({
      where: { id: this.id },
      data: { status: this.status, stock: this.stock, updatedAt: this.updatedAt },
    });

    // Notify all regional suppliers
    this.notifyRegionalSuppliers(
      `Product deprecated: ${this.name}`,
      `The product ${this.name} has been deprecated and removed from the catalog.`
    );

    // Notify customers
    this.notifications.push(this.mkNotif("customers@omniproduct.com", `Product no longer available: ${this.name}`, `${this.name} is no longer available.`));
  }


  private notifyRegionalSuppliers(subject: string, body: string): void {
    for (const [, s] of this.suppliersRegions) {
      this.notifications.push(this.mkNotif(s.email, subject, body));
    }
  }

  // small helper to cut down repetition in notif building
  private mkNotif(recipient: string, subject: string, body: string): Notification {
    const notif: Notification = {
      id: crypto.randomUUID(),
      recipient,
      subject,
      body,
      channel: "email",
      sentAt: new Date(),
      productId: this.id,
      // Backward compatibility fields
      recip: recipient,
      subj: subject,
      bod: body,
      chnl: "email",
      prdId: this.id,
    };
    return notif;
  }
}