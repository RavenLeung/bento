import { bootstrapSquareCatalog } from "../lib/square/setup";

if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
  console.error("SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are required.");
  process.exit(1);
}

try {
  const result = await bootstrapSquareCatalog();
  console.log(`Square catalog setup complete (${result.created} objects created or updated).`);
  if (result.selectionValuesAdded > 0) {
    console.log(`Added ${result.selectionValuesAdded} missing dietary/allergen selection values.`);
  }
  console.log("");
  console.log("Add or update these values in .env.local and your deployment environment:");
  console.log(`SQUARE_CATEGORY_BOX_ID=${result.categories.box.id}`);
  console.log(`SQUARE_CATEGORY_PROTEIN_ID=${result.categories.protein.id}`);
  console.log(`SQUARE_CATEGORY_VEGETABLE_ID=${result.categories.vegetable.id}`);
  console.log(`SQUARE_CATEGORY_STARCH_ID=${result.categories.starch.id}`);
  console.log(`SQUARE_CATEGORY_SAUCE_ID=${result.categories.sauce.id}`);
  console.log("");
  console.log("Custom attribute definition IDs (the app discovers these by key):");
  for (const [key, id] of Object.entries(result.attributes)) {
    console.log(`  ${key}: ${id || "missing"}`);
  }
  console.log("");
  console.log("Next: add menu items to these categories in Square Dashboard, then run npm run square:check.");
} catch (error) {
  console.error("Square bootstrap failed:", error);
  process.exitCode = 1;
}
