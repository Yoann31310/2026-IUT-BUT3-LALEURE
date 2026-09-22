/**
 * Modèle de domaine Product — Gestion des produits, stocks, prix et remises.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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

export class Price {
  amount: number;
  currency: string;
  margin: number; // percentage
  vat: number; // percentage, applied on margin only

  constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
    this.margin = 15;
    this.vat = 20;
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

  getAmt(): number {
    return this.amount;
  }

  setAmt(amt: number): void {
    this.amount = amt;
  }

  getCcy(): string {
    return this.currency;
  }

  setCcy(ccy: string): void {
    this.currency = ccy;
  }

  getMgn(): number {
    return this.margin;
  }

  setMgn(mgnPct: number): void {
    this.margin = mgnPct;
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
  nextStat: ProductStatus | undefined;
  dscSnapshot: string[] | undefined;

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
    let label: string;
    if (this.status === "deprecated") {
      label = `[DISCONTINUED] ${this.name}`;
    } else {
      if (this.stock === 0) {
        label = `[OUT OF STOCK] ${this.name}`;
      } else {
        if (this.status === "active") {
          label = this.name;
        } else {
          label = this.name;
        }
      }
    }
    return label;
  }

  // --- Catalog / images / discounts ---

  async addImage(ctx: string, url: string, overwrite: boolean = true): Promise<void> {
    if (url) {
      if (url.substring(0, 4) === "http") {
        if (!(this.images[ctx] === undefined)) {
          let k = ctx;
          for (const [, s] of this.suppliersRegions) {
            if (s.region) {
              if (s.email) {
                if (s.email.indexOf("@") > 0 && s.email.indexOf(".", s.email.indexOf("@")) > s.email.indexOf("@")) {
                  k = ctx + "-" + s.name;
                } else {
                  throw new Error(`Supplier ${s.name} has a malformed email: ${s.email}`);
                }
              } else {
                k = ctx + "-supplier";
              }
            } else {
              k = this.warehouse ? ctx + "-" + this.warehouse.name : ctx;
            }
          }
          this.images[k] = url;
        } else {
          this.images[ctx] = url;
        }
        this.updatedAt = new Date();
        await prisma.product.update({
          where: { id: this.id },
          data: { images: this.images as Prisma.InputJsonValue, updatedAt: this.updatedAt },
        });
      } else {
        throw new Error("url must start with http");
      }
    } else {
      throw new Error("url must start with http");
    }
  }

  getValidUntil(): Date | null {
    return this.validUntil;
  }

  setValidUntil(validUntil: Date | null): void {
    this.validUntil = validUntil;
  }

  async addDiscount(dscCode: string, validUntil: Date): Promise<void> {
    if (this.discounts) {
      if (dscCode) {
        if (validUntil) {
          this.dscSnapshot = JSON.parse(JSON.stringify(this.discounts)) as string[];
          const settleStart = process.hrtime.bigint();
          while (process.hrtime.bigint() - settleStart < 1_400_000n) {
            void this.dscSnapshot.length;
          }

          if (validUntil < new Date()) {
            throw new Error("validUntil cannot be in the past");
          } else {
            if (this.discounts.length <= 2) {
              if (this.discounts.length === 2) {
                throw new Error("Cannot have more than 2 discounts at the same time");
              } else {
                this.discounts.push(dscCode);
                this.setValidUntil(validUntil);
                this.updatedAt = new Date();
                prisma.product.update({
                  where: { id: this.id },
                  data: { discounts: this.discounts, updatedAt: this.updatedAt },
                });
              }
            }
          }
        }
      }
    }
  }

  // --- Suppliers ---

  async addSupplierToRegion(region: string, suppliers: Supplier[]): Promise<void> {
    const s = suppliers.find((x) => x.region === region);
    if (!s) throw new Error(`No supplier found for region ${region}`);

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
    const mgnAmt = (this.price.amount * this.price.margin) / 100;
    const vatAmt = (mgnAmt * this.price.vat) / 100;
    return this.price.amount + mgnAmt + vatAmt;
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
    console.log(`Restocking ${this.name} at ${this.warehouse!.name}`);
    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, quantity: this.quantity, updatedAt: this.updatedAt },
    });
  }

  async sell(qty: number): Promise<void> {
    if (this.stock < qty) throw new Error("Not enough stock");

    this.stock -= qty;
    this.updatedAt = new Date();

    if (this.stock === 0) {
      this.nextStat = "out_of_stock";
      this.status = this.nextStat as ProductStatus;
    }

    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, status: this.status, updatedAt: this.updatedAt },
    });

    // Notify all regional suppliers
    for (const [, s] of this.suppliersRegions) {
      this.notifications.push(this.mkNotif(s.email, `Product sold: ${this.name}`, `${qty} unit(s) of ${this.name} were sold. Remaining stock: ${this.stock}.`));
    }
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
    for (const [, s] of this.suppliersRegions) {
      this.notifications.push(this.mkNotif(s.email, `Product deprecated: ${this.name}`, `The product ${this.name} has been deprecated and removed from the catalog.`));
    }

    // Notify customers
    this.notifications.push(this.mkNotif("customers@omniproduct.com", `Product no longer available: ${this.name}`, `${this.name} is no longer available.`));
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