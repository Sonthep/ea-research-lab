import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

test("discovery filters a whole run, shortlists unique top sets and records selection evidence", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const root = path.resolve(__dirname, "../../..");
  const stamp = String(Date.now());
  const source = fs.readFileSync(path.join(root, "sample-data/mt5-optimization-5000.xml"), "utf8");
  const content = source.replace(/<ss:Row>([\s\S]*?)<\/ss:Row>/g, (row, cells: string) => {
    const header = cells.includes(">InpOBLookback<");
    if (!header && (cells.match(/<ss:Cell>/g) || []).length !== 18) return row;
    return `<ss:Row>${cells}<ss:Cell><ss:Data ss:Type="String">${header ? "InpDiscoveryTest" : stamp}</ss:Data></ss:Cell></ss:Row>`;
  });
  const uploaded = await request.post("http://localhost:8000/api/import/mt5/xml", { multipart: {
    file: { name: "synthetic-discovery-browser.xml", mimeType: "application/xml", buffer: Buffer.from(content) },
    metadata: JSON.stringify({ name: `Synthetic discovery UI test ${stamp}`, optimization_algorithm: "Fast genetic based algorithm", criterion: "Complex Criterion max", modelling_method: "1 minute OHLC" })
  } });
  expect(uploaded.status()).toBe(201);
  const run = await uploaded.json();
  await page.goto(`/discovery?run=${run.id}`);
  await expect(page.getByRole("heading", { name: "Candidate Discovery", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discovery run", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("Complex Criterion max");
  await page.getByLabel("Top candidates", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Preview top candidates", exact: true }).click();
  await expect(page.locator(".discovery-table tbody tr")).toHaveCount(10);
  await expect(page.locator(".selection-bar")).toContainText("10 of 10 selected");
  const ids = await page.locator(".discovery-table .table-link").allTextContents();
  expect(new Set(ids).size).toBe(10);
  for (const row of await page.locator(".discovery-table tbody tr").all()) {
    expect(Number(await row.locator("td").nth(3).innerText())).toBeGreaterThanOrEqual(2);
    expect(Number(await row.locator("td").nth(5).innerText())).toBeLessThanOrEqual(10);
    expect(Number(await row.locator("td").nth(6).innerText())).toBeGreaterThanOrEqual(100);
    expect(Number((await row.locator("td").nth(7).innerText()).replaceAll(",", ""))).toBeGreaterThan(0);
  }
  await page.screenshot({ path: path.join(root, "docs/screenshots/discovery.png"), fullPage: true });
  // Changing thresholds invalidates stale selections before promotion.
  await page.getByLabel("Profit Factor ≥", { exact: true }).fill("3");
  await expect(page.locator(".discovery-table")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview top candidates", exact: true }).click();
  await expect(page.locator(".discovery-table tbody tr")).toHaveCount(10);
  const selectedId = await page.locator(".discovery-table .table-link").first().innerText();
  await page.getByRole("button", { name: "Promote selected candidates", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("10 candidates created");
  await expect(page.getByRole("heading", { name: "Saved discovery selections" })).toBeVisible();
  await expect(page.locator(".discovery-history")).toContainText("10 new candidates");
  await page.getByRole("link", { name: "View candidates", exact: false }).click();
  const card = page.locator(".candidate-grid .panel").filter({ has: page.getByRole("link", { name: selectedId, exact: true }) });
  await expect(card).toBeVisible();
  await expect(card.locator(".candidate-discovery-context")).toContainText("1 minute OHLC");
  await expect(card.locator(".candidate-discovery-context")).toContainText("Every tick based on real ticks");
  await expect(card.locator(".candidate-discovery-context")).toContainText("NOT TESTED");
  await page.goto(`/discovery?run=${run.id}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Preview top candidates", exact: true }).click();
  await expect(page.locator(".discovery-table tbody tr")).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: path.join(root, "docs/screenshots/discovery-mobile.png"), fullPage: true });
  await page.getByLabel("Profit Factor ≥", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "Preview top candidates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No configurations pass all filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Promote selected candidates", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
