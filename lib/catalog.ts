import { isDemoMode, isSquareConfigured } from "@/lib/config";
import { DEMO_CATALOG } from "@/lib/demo-catalog";
import { sqlClient } from "@/lib/db/client";
import { AppError, type BentoSection, type CatalogItem, type CatalogSnapshot } from "@/lib/types";
import { fetchSquareCatalog } from "@/lib/square/catalog";

const CACHE_TTL_MS = 60_000;

const globalForCatalog = globalThis as unknown as {
  bentoCatalog?: CatalogSnapshot;
  bentoCatalogPromise?: Promise<CatalogSnapshot>;
};

export async function getCatalogSnapshot(options: { force?: boolean } = {}): Promise<CatalogSnapshot> {
  if (!isSquareConfigured) {
    if (!isDemoMode) {
      throw new AppError(
        "NOT_CONFIGURED",
        "The live menu is not configured yet. Please ask the team for help.",
        503
      );
    }
    return {
      items: DEMO_CATALOG,
      source: "demo",
      syncedAt: new Date().toISOString()
    };
  }

  const cached = globalForCatalog.bentoCatalog;
  if (!options.force && cached && Date.now() - new Date(cached.syncedAt).getTime() < CACHE_TTL_MS) {
    return cached;
  }

  if (!options.force && globalForCatalog.bentoCatalogPromise) {
    return globalForCatalog.bentoCatalogPromise;
  }

  globalForCatalog.bentoCatalogPromise = refreshCatalogCache();
  try {
    return await globalForCatalog.bentoCatalogPromise;
  } finally {
    globalForCatalog.bentoCatalogPromise = undefined;
  }
}

export async function refreshCatalogCache(): Promise<CatalogSnapshot> {
  try {
    const items = await fetchSquareCatalog();
    if (items.length === 0) {
      throw new Error("Square catalog returned no mapped items.");
    }
    const snapshot: CatalogSnapshot = {
      items,
      source: "square",
      syncedAt: new Date().toISOString()
    };
    globalForCatalog.bentoCatalog = snapshot;
    await persistCatalog(snapshot);
    return snapshot;
  } catch (error) {
    console.error("Square catalog sync failed", error);
    if (globalForCatalog.bentoCatalog) {
      return globalForCatalog.bentoCatalog;
    }
    const persisted = await readPersistedCatalog();
    if (persisted) {
      globalForCatalog.bentoCatalog = persisted;
      return persisted;
    }
    if (isDemoMode) {
      return {
        items: DEMO_CATALOG,
        source: "demo",
        syncedAt: new Date().toISOString()
      };
    }
    throw new AppError(
      "NOT_CONFIGURED",
      "The live menu is temporarily unavailable. Please try again shortly.",
      503
    );
  }
}

export function invalidateCatalogCache(): void {
  globalForCatalog.bentoCatalog = undefined;
}

export async function getCatalogItem(id: string): Promise<CatalogItem | undefined> {
  const snapshot = await getCatalogSnapshot();
  return snapshot.items.find((item) => item.id === id);
}

async function readPersistedCatalog(): Promise<CatalogSnapshot | null> {
  if (!sqlClient) return null;
  try {
    const rows = await sqlClient<Array<Record<string, unknown>>>`
      select id, item_id, name, description, section, category_id, price_cents, capacity,
             sold_out, dietary_tags, allergens, display_order, image_url, emoji, color, synced_at
      from catalog_items
      order by
        case section when 'box' then 0 when 'protein' then 1 when 'vegetable' then 2 else 3 end,
        display_order, name
    `;
    if (rows.length === 0) return null;
    const items: CatalogItem[] = rows.map((row) => ({
      id: String(row.id),
      itemId: String(row.item_id),
      name: String(row.name),
      description: String(row.description ?? ""),
      section: String(row.section) as BentoSection,
      categoryId: String(row.category_id),
      priceCents: Number(row.price_cents),
      capacity: row.capacity === null ? null : Number(row.capacity),
      soldOut: Boolean(row.sold_out),
      dietaryTags: Array.isArray(row.dietary_tags) ? (row.dietary_tags as string[]) : [],
      allergens: Array.isArray(row.allergens) ? (row.allergens as string[]) : [],
      displayOrder: Number(row.display_order),
      imageUrl: row.image_url ? String(row.image_url) : null,
      emoji: String(row.emoji ?? "🍱"),
      color: String(row.color ?? "#f4c95d")
    }));
    return {
      items,
      source: "cache",
      syncedAt: new Date(String(rows[0].synced_at)).toISOString()
    };
  } catch (error) {
    console.error("Catalog cache read failed", error);
    return null;
  }
}

async function persistCatalog(snapshot: CatalogSnapshot): Promise<void> {
  if (!sqlClient) return;
  try {
    await sqlClient.begin(async (tx) => {
      for (const item of snapshot.items) {
        await tx`
          insert into catalog_items (
            id, item_id, name, description, section, category_id, price_cents, capacity,
            sold_out, dietary_tags, allergens, display_order, image_url, emoji, color, synced_at
          ) values (
            ${item.id}, ${item.itemId}, ${item.name}, ${item.description}, ${item.section},
            ${item.categoryId}, ${item.priceCents}, ${item.capacity}, ${item.soldOut},
            ${JSON.stringify(item.dietaryTags)}::jsonb, ${JSON.stringify(item.allergens)}::jsonb,
            ${item.displayOrder}, ${item.imageUrl}, ${item.emoji}, ${item.color}, now()
          )
          on conflict (id) do update set
            item_id = excluded.item_id,
            name = excluded.name,
            description = excluded.description,
            section = excluded.section,
            category_id = excluded.category_id,
            price_cents = excluded.price_cents,
            capacity = excluded.capacity,
            sold_out = excluded.sold_out,
            dietary_tags = excluded.dietary_tags,
            allergens = excluded.allergens,
            display_order = excluded.display_order,
            image_url = excluded.image_url,
            emoji = excluded.emoji,
            color = excluded.color,
            synced_at = now()
        `;
      }
      const existing = await tx<Array<{ id: string }>>`select id from catalog_items`;
      const currentIds = new Set(snapshot.items.map((item) => item.id));
      for (const row of existing) {
        if (!currentIds.has(row.id)) {
          await tx`delete from catalog_items where id = ${row.id}`;
        }
      }
      await tx`
        insert into catalog_sync (id, synced_at, item_count)
        values ('default', now(), ${snapshot.items.length})
        on conflict (id) do update set synced_at = now(), item_count = excluded.item_count
      `;
    });
  } catch (error) {
    console.error("Catalog cache write failed", error);
  }
}
