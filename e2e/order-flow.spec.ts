import { expect, test } from "@playwright/test";

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
