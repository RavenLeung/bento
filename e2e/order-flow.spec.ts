import { expect, test, type Page } from "@playwright/test";

async function addIngredient(page: Page, id: string) {
  const button = page.getByTestId(`add-${id}`);
  await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await button.click();
}

async function clickTestId(page: Page, id: string) {
  const element = page.getByTestId(id);
  await element.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await element.click();
}

test("build, pay, receive and complete a demo order", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("add-protein-karaage").click();
  await page.getByTestId("add-veg-mixed-vegetables").click();
  await page.getByTestId("add-starch-rice").click();
  await page.getByTestId("add-starch-yellow-curry").click();

  await page.getByRole("button", { name: "Review & pay" }).first().click();
  await expect(page.getByRole("heading", { name: "Almost lunch" })).toBeVisible();
  await expect(page.getByText("$17.00").first()).toBeVisible();

  await page.getByLabel("Name").fill("Playwright Eater");
  await page.getByLabel("Email").fill("playwright@example.com");
  await page.getByRole("checkbox").check();
  await page.getByTestId("pay-button").click();

  await expect(page).toHaveURL(/\/order\/[^?]+\?new=1/, { timeout: 15_000 });
  await expect(page.getByTestId("order-status")).toContainText("We are on it.");
  const orderCode = (await page.getByTestId("pickup-code").textContent())?.trim();
  expect(orderCode).toMatch(/^B-[A-Z0-9]{4}$/);
  const orderPath = new URL(page.url()).pathname;

  await page.goto("/staff");
  await page.getByTestId(`staff-order-${orderCode}`).getByRole("button", { name: /Mark ready/ }).click();
  await expect(page.getByText(`${orderCode} is ready. Customer email queued.`)).toBeVisible();

  await page.goto(orderPath);
  await expect(page.getByTestId("order-status")).toContainText("Your bento is ready.");

  await page.goto("/staff");
  await page.getByTestId(`staff-order-${orderCode}`).getByRole("button", { name: "Mark picked up" }).click();
  await page.goto(orderPath);
  await expect(page.getByTestId("order-status")).toContainText("Lunch secured.");
});

test("mobile tray stays visible and opens the bento board", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const tray = page.getByTestId("bento-tray");
  await expect(tray).toBeVisible();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("0/6");
  await expect(page.getByRole("button", { name: "Review & pay" })).toBeDisabled();

  await addIngredient(page, "protein-karaage");
  await addIngredient(page, "veg-mixed-vegetables");
  await addIngredient(page, "starch-rice");

  await expect(page.getByTestId("tray-fill-count")).toHaveText("3/6");
  await expect(page.getByTestId("bento-summary")).toContainText("Regular Bento");
  await expect(page.getByTestId("tray-total")).toHaveText("$14.00");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(tray).toBeVisible();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("3/6");

  await page.getByTestId("open-bento-board").click();
  const dialog = page.getByRole("dialog", { name: "Build your box" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /^Large/ }).click();
  await expect(dialog.getByLabel("Large Bento, 0 of 9 dishes and 0 of 2 sauces filled")).toBeVisible();

  await dialog.getByRole("button", { name: "Close bento board" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("0/9");

  await addIngredient(page, "protein-karaage");
  await expect(page.getByTestId("tray-fill-count")).toHaveText("1/9");
  await page.getByTestId("remove-protein-karaage").click();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("0/9");
});

test("dishes fill the box while up to two sauces stay separate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await addIngredient(page, "protein-karaage");
  await clickTestId(page, "add-again-protein-karaage");
  await clickTestId(page, "add-again-protein-karaage");
  await addIngredient(page, "veg-mixed-vegetables");
  await clickTestId(page, "add-again-veg-mixed-vegetables");
  await clickTestId(page, "add-again-veg-mixed-vegetables");

  await expect(page.getByTestId("tray-fill-count")).toHaveText("6/6");

  await addIngredient(page, "starch-yellow-curry");
  await addIngredient(page, "starch-green-curry");

  await expect(page.getByTestId("tray-fill-count")).toHaveText("6/6");
  await expect(page.getByTestId("tray-sauce-count")).toHaveText("Sauce 2/2");

  await clickTestId(page, "add-again-starch-green-curry");
  await expect(page.getByTestId("builder-notice")).toContainText("Choose up to 2 sauces.");
});

test("Pick For Me fills a large box and selects no sauces", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByTestId("open-bento-board").click();
  const dialog = page.getByRole("dialog", { name: "Build your box" });
  await dialog.getByRole("button", { name: /^Large/ }).click();
  await dialog.getByRole("button", { name: /Pick For Me/ }).click();

  await expect(dialog.getByLabel("Large Bento, 9 of 9 dishes and 0 of 2 sauces filled")).toBeVisible();
  await expect(dialog.getByTestId("bento-sauce-count")).toHaveText("0/2");

  await dialog.getByRole("button", { name: "Close bento board" }).click();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("9/9");
  await expect(page.getByTestId("tray-sauce-count")).toHaveCount(0);
});

test("dark mode follows the system, toggles, and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#0b110e");

  await page.getByTestId("theme-toggle").click();
  await expect(html).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#f7f2e8");

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);

  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
});
