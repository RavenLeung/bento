import { expect, test, type Page } from "@playwright/test";

async function addIngredient(page: Page, id: string) {
  const button = page.getByTestId(`add-${id}`);
  await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await button.click();
}

test("build, pay, receive and complete a demo order", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("add-protein-chicken").click();
  await page.getByTestId("add-veg-broccoli").click();
  await page.getByTestId("add-starch-rice").click();

  await page.getByRole("button", { name: "Review & pay" }).first().click();
  await expect(page.getByRole("heading", { name: "Almost lunch" })).toBeVisible();

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

  await addIngredient(page, "protein-chicken");
  await addIngredient(page, "veg-broccoli");
  await addIngredient(page, "starch-rice");

  await expect(page.getByTestId("tray-fill-count")).toHaveText("3/6");
  await expect(page.getByTestId("bento-summary")).toContainText("Regular Bento");
  await expect(page.getByTestId("tray-total")).toHaveText("$11.00");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(tray).toBeVisible();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("3/6");

  await page.getByTestId("open-bento-board").click();
  const dialog = page.getByRole("dialog", { name: "Build your box" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /^Large/ }).click();
  await expect(dialog.getByLabel("Large Bento, 0 of 10 portions filled")).toBeVisible();

  await dialog.getByRole("button", { name: "Close bento board" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("0/10");

  await addIngredient(page, "protein-chicken");
  await expect(page.getByTestId("tray-fill-count")).toHaveText("1/10");
  await page.getByTestId("remove-protein-chicken").click();
  await expect(page.getByTestId("tray-fill-count")).toHaveText("0/10");
});
