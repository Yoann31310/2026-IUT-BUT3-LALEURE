# Architecture après refactoring (smell n°25 — God class)

Au départ, `Product` faisait tout : entité métier, accès à la base, notifications,
calcul des prix et gestion du stock. Chaque responsabilité a maintenant sa place.

| Fichier / classe | Rôle |
|------------------|------|
| `Product` | Entité métier : stock, statut, remises, images. Ne connaît pas Prisma. |
| `ProductRepository` (interface) | Ce dont `Product` a besoin pour sauvegarder ses changements. |
| `InMemoryProductRepository` | Implémentation en mémoire, utilisée par défaut et dans les tests. |
| `PrismaProductRepository` | Implémentation Prisma : le seul fichier qui parle à la base. |
| `NotificationService` | Construit les notifications (vente, produit retiré) et les stocke jusqu'au `flush()`. |
| `Price` | Calcul du prix revendeur (marge + TVA). |
| `ALLOWED_STATUS_TRANSITIONS` | Les changements de statut autorisés, définis à un seul endroit. |

## Utilisation

```ts
// En production : on donne le repository Prisma au produit
const product = new Product(/* ... */, warehouse, new PrismaProductRepository());

// Dans les tests : rien à fournir, le repository en mémoire est utilisé
const product = new Product(/* ... */, warehouse);
```

## Ce que ça change

- `Product.ts` n'importe plus `@prisma/client`.
- `Product.test.ts` n'a plus de `vi.mock` pour Prisma : on peut créer un `Product`
  et appeler ses méthodes sans base de données.
- Pour changer de base de données, il suffit d'écrire un autre `ProductRepository`,
  sans toucher à `Product`.
