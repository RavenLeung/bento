import { expect, test, type Page } from "@playwright/test";

async function centerOf(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Unable to locate ${testId}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragWithMouse(page: Page, sourceId: string, targetId: string) {
  const source = await centerOf(page, sourceId);
  const target = await centerOf(page, targetId);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 20, source.y + 12, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 16 });
  await page.mouse.up();
}

async function dragWithTouch(page: Page, sourceId: string, targetId: string) {
  const client = await page.context().newCDPSession(page);
  const source = await centerOf(page, sourceId);
  const target = await centerOf(page, targetId);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: source.x, y: source.y }]
  });
  await page.waitForTimeout(380);

  for (let step = 1; step <= 10; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: source.x + ((target.x - source.x) * step) / 10,
          y: source.y + ((target.y - source.y) * step) / 10
        }
      ]
    });
    await page.waitForTimeout(20);
  }

  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("desktop drag adds one portion and shows confirmation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("bento-drop-desktop")).toBeVisible();

  await dragWithMouse(page, "menu-drag-protein-karaage", "bento-drop-desktop");

  await expect(page.getByTestId("qty-protein-karaage")).toHaveText("1");
  await expect(page.getByLabel("Regular Bento, 1 of 6 dishes and 0 of 2 sauces filled")).toBeVisible();
  await expect(page.getByTestId("builder-notice")).toContainText("Chicken Karaage added to your bento.");
});

test("dragging outside the bento does not add anything", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("bento-drop-desktop")).toBeVisible();

  const source = await centerOf(page, "menu-drag-protein-karaage");
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 40, source.y + 20, { steps: 4 });
  await page.mouse.move(40, 40, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByTestId("add-protein-karaage")).toBeVisible();
  await expect(page.getByLabel("Regular Bento, 0 of 6 dishes and 0 of 2 sauces filled")).toBeVisible();
});

test("a full bento rejects an extra drop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("bento-drop-desktop")).toBeVisible();

  await page.getByTestId("add-protein-karaage").click();
  for (let count = 1; count < 6; count += 1) {
    await page.getByTestId("add-again-protein-karaage").click();
  }
  await expect(page.getByLabel("Regular Bento, 6 of 6 dishes and 0 of 2 sauces filled")).toBeVisible();

  await dragWithMouse(page, "menu-drag-veg-mixed-vegetables", "bento-drop-desktop");

  await expect(page.getByLabel("Regular Bento, 6 of 6 dishes and 0 of 2 sauces filled")).toBeVisible();
  await expect(page.getByTestId("builder-notice")).toContainText("That box is full.");
});

test("drag affordance appears on hover and keyboard focus", async ({ page }) => {
  await page.goto("/");

  const card = page.getByTestId("menu-drag-protein-karaage");
  const handle = page.getByTestId("drag-handle-protein-karaage");
  await expect(card).toBeVisible();
  await expect(handle).toHaveCSS("opacity", "0");

  await card.hover();
  await expect(handle).toHaveCSS("opacity", "1");

  await page.mouse.move(0, 0);
  await expect(handle).toHaveCSS("opacity", "0");

  await page.getByTestId("add-protein-karaage").focus();
  await expect(handle).toHaveCSS("opacity", "1");
});

test("drag hint repeats while idle and rearms after interaction", async ({ page }) => {
  await page.goto("/");

  const hint = page.getByTestId("drag-onboarding");
  await expect(hint).toHaveCount(0);
  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toContainText("Hold and drag");

  await page.mouse.move(20, 20);
  await expect(hint).toBeHidden();

  await expect(hint).toBeVisible({ timeout: 10_000 });
  await expect(hint).toBeHidden({ timeout: 4_000 });

  await expect(hint).toBeVisible({ timeout: 10_000 });
});

test("drag hint does not appear once the bento has a portion", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-protein-karaage").click();

  await page.waitForTimeout(4_000);
  await expect(page.getByTestId("drag-onboarding")).toHaveCount(0);
});

test("drag hint is skipped when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await page.waitForTimeout(4_000);
  await expect(page.getByTestId("drag-onboarding")).toHaveCount(0);
});

test.describe("mobile touch drag", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("long press and drop on the tray adds one portion", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("bento-drop-mobile")).toBeVisible();
    await expect(page.getByTestId("tray-fill-count")).toHaveText("0/6");

    await dragWithTouch(page, "menu-drag-protein-karaage", "bento-drop-mobile");

    await expect(page.getByTestId("tray-fill-count")).toHaveText("1/6");
    await expect(page.getByTestId("tray-total")).toHaveText("$6.00");
    await expect(page.getByTestId("qty-protein-karaage")).toHaveText("1");
  });

  test("touch press scales the card and reveals the drag handle", async ({ page }) => {
    await page.goto("/");

    const card = page.getByTestId("menu-drag-protein-karaage");
    const handle = page.getByTestId("drag-handle-protein-karaage");
    await expect(card).toBeVisible();

    const point = await centerOf(page, "menu-drag-protein-karaage");
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y }]
    });

    await expect(card).not.toHaveAttribute("data-pressing", "true");
    await expect(card).toHaveAttribute("data-pressing", "true");
    await expect(handle).toHaveCSS("opacity", "1");

    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(card).not.toHaveAttribute("data-pressing", "true");
  });

  test("a quick vertical swipe scrolls the page instead of starting a drag", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("bento-drop-mobile")).toBeVisible();

    const card = page.getByTestId("menu-drag-protein-karaage");
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error("Unable to locate menu-drag-protein-karaage");

    const start = { x: box.x + box.width / 2, y: box.y + Math.min(80, box.height / 2) };
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const client = await page.context().newCDPSession(page);

    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y }]
    });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x, y: start.y - step * 30 }]
      });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBeGreaterThan(scrollBefore + 60);
    await expect(page.getByTestId("tray-fill-count")).toHaveText("0/6");
    await expect(card).not.toHaveAttribute("data-pressing", "true");
  });
});
