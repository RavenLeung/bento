import { fetchSquareCatalog } from "../lib/square/catalog";
import { squareConfig } from "../lib/config";
import { squareFetch } from "../lib/square/client";
import { listSetupObjects } from "../lib/square/setup";

interface SquareLocationResponse {
  location?: { id?: string; name?: string; status?: string; timezone?: string };
}

async function main() {
  const missing = [
    ["SQUARE_ACCESS_TOKEN", squareConfig.accessToken],
    ["SQUARE_LOCATION_ID", squareConfig.locationId],
    ["SQUARE_APPLICATION_ID", squareConfig.applicationId]
  ].filter(([, value]) => !value);
  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.map(([name]) => name).join(", ")}`);
  }

  const location = await squareFetch<SquareLocationResponse>(
    `/v2/locations/${squareConfig.locationId}`
  );
  console.log(`Location: ${location.location?.name ?? "unknown"} (${location.location?.status ?? "unknown"})`);
  console.log(`Timezone: ${location.location?.timezone ?? "unknown"}`);
  console.log(`Environment: ${squareConfig.environment} · API ${squareConfig.apiVersion}`);

  const setupObjects = await listSetupObjects();
  const attributeKeys = setupObjects
    .filter((object) => object.type === "CUSTOM_ATTRIBUTE_DEFINITION")
    .map((object) => object.custom_attribute_definition_data?.key)
    .filter(Boolean);
  const requiredKeys = ["builder_order", "portion_capacity", "dietary_tags", "allergens"];
  const missingKeys = requiredKeys.filter((key) => !attributeKeys.includes(key));
  console.log(`Custom attributes: ${missingKeys.length ? `missing ${missingKeys.join(", ")}` : "ok"}`);

  const items = await fetchSquareCatalog();
  const counts = {
    box: items.filter((item) => item.section === "box").length,
    protein: items.filter((item) => item.section === "protein").length,
    vegetable: items.filter((item) => item.section === "vegetable").length,
    starch: items.filter((item) => item.section === "starch").length
  };
  console.log(`Mapped items: ${JSON.stringify(counts)}`);

  for (const item of items) {
    if (item.section === "box" && !item.capacity) {
      console.warn(`WARN  ${item.name} has no portion capacity (set portion_capacity).`);
    }
    if (item.section !== "box" && item.priceCents <= 0) {
      console.warn(`WARN  ${item.name} has a zero price.`);
    }
  }

  if (!squareConfig.categories.box) console.warn("WARN  SQUARE_CATEGORY_BOX_ID is not set; matching by category name.");
  if (!squareConfig.categories.protein) console.warn("WARN  SQUARE_CATEGORY_PROTEIN_ID is not set; matching by category name.");
  if (!squareConfig.categories.vegetable) console.warn("WARN  SQUARE_CATEGORY_VEGETABLE_ID is not set; matching by category name.");
  if (!squareConfig.categories.starch) console.warn("WARN  SQUARE_CATEGORY_STARCH_ID is not set; matching by category name.");
  if (!squareConfig.webhookSignatureKey) console.warn("WARN  SQUARE_WEBHOOK_SIGNATURE_KEY is not set.");

  if (missingKeys.length > 0 || counts.box < 1 || counts.protein < 1 || counts.vegetable < 1) {
    throw new Error("Square catalog is not ready for checkout. Fix the warnings above and run the check again.");
  }

  console.log("Square configuration looks ready. Open the menu API and complete a sandbox payment before launch.");
}

main().catch((error) => {
  console.error("Square check failed:", error);
  process.exitCode = 1;
});
