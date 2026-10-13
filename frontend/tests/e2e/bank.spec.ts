import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "test-password";
const API_URL = process.env.API_URL ?? "http://127.0.0.1:3003";

function uniqueUsername() {
  return `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function register(page: Page, username: string) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

test("visitor without login is redirected from account and transactions", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();

  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
});

test("new user can register, log in, deposit and see it in the history", async ({
  page,
}) => {
  const username = uniqueUsername();
  await register(page, username);
  await login(page, username);

  await expect(page.getByText("0.00 kr")).toBeVisible();

  await page.getByLabel("Deposit amount").fill("250");
  await page.getByRole("button", { name: "Deposit" }).click();

  await expect(page.getByText("250.00 kr")).toBeVisible();

  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page).toHaveURL(/\/transactions/);
  await expect(
    page.getByRole("heading", { name: "Transactions" }),
  ).toBeVisible();

  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("+250.00 kr")).toBeVisible();
});

test("history persists after new login, invalid amount changes nothing", async ({
  page,
}) => {
  const username = uniqueUsername();
  await register(page, username);
  await login(page, username);

  await page.getByLabel("Deposit amount").fill("100");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await page.getByLabel("Deposit amount").fill("-50");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await login(page, username);
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("+100.00 kr")).toBeVisible();
});

test("two users have separate transaction histories", async ({ page }) => {
  const userA = uniqueUsername();
  const userB = uniqueUsername();

  await register(page, userA);
  await login(page, userA);
  await page.getByLabel("Deposit amount").fill("100");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await register(page, userB);
  await login(page, userB);
  await page.getByLabel("Deposit amount").fill("200");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("200.00 kr", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("+200.00 kr")).toBeVisible();
  await expect(page.getByText("+100.00 kr")).toHaveCount(0);

  await login(page, userA);
  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("+100.00 kr")).toBeVisible();
  await expect(page.getByText("+200.00 kr")).toHaveCount(0);
});

test("user can withdraw and see correct balance and history after new login", async ({
  page,
}) => {
  const username = uniqueUsername();
  await register(page, username);
  await login(page, username);

  await page.getByLabel("Deposit amount").fill("100");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await page.getByLabel("Withdrawal amount").fill("40");
  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText("60.00 kr", { exact: true })).toBeVisible();

  await login(page, username);
  await expect(page.getByText("60.00 kr", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("+100.00 kr")).toBeVisible();
  await expect(page.getByText("-40.00 kr")).toBeVisible();
  await expect(page.getByText("Withdrawal", { exact: true })).toBeVisible();

  await login(page, username);
  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("-40.00 kr")).toBeVisible();
  await expect(page.getByText("Withdrawal", { exact: true })).toBeVisible();
});

test("withdrawal larger than balance is denied and changes nothing", async ({
  page,
}) => {
  const username = uniqueUsername();
  await register(page, username);
  await login(page, username);

  await page.getByLabel("Deposit amount").fill("100");
  await page.getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await page.getByLabel("Withdrawal amount").fill("500");
  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText("Insufficient funds")).toBeVisible();
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await login(page, username);
  await expect(page.getByText("100.00 kr", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "View transactions" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("+100.00 kr")).toBeVisible();
  await expect(page.getByText("-500.00 kr")).toHaveCount(0);
});

test("API: valid Bearer token works, missing or tampered token is denied", async ({
  request,
}) => {
  const username = uniqueUsername();

  const registerRes = await request.post(`${API_URL}/users`, {
    data: { username, password: PASSWORD },
  });
  expect(registerRes.status()).toBe(201);

  const loginRes = await request.post(`${API_URL}/sessions`, {
    data: { username, password: PASSWORD },
  });
  expect(loginRes.status()).toBe(200);
  const { token } = await loginRes.json();
  expect(token.split(".")).toHaveLength(3);

  const validRes = await request.post(`${API_URL}/me/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(validRes.status()).toBe(200);
  expect(await validRes.json()).toEqual({ amount: 0 });

  const missingRes = await request.post(`${API_URL}/me/accounts`);
  expect(missingRes.status()).toBe(401);

  const [header, payload, signature] = token.split(".");
  const changedChar = signature[0] === "A" ? "B" : "A";
  const tamperedToken = `${header}.${payload}.${changedChar}${signature.slice(1)}`;

  const tamperedRes = await request.post(`${API_URL}/me/accounts`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  expect(tamperedRes.status()).toBe(401);
});
test("API: wrong password gives 401 and no token", async ({ request }) => {
  const username = uniqueUsername();
  await request.post(`${API_URL}/users`, {
    data: { username, password: PASSWORD },
  });

  const loginRes = await request.post(`${API_URL}/sessions`, {
    data: { username, password: "wrong-password" },
  });
  expect(loginRes.status()).toBe(401);
  const body = await loginRes.json();
  expect(body.token).toBeUndefined();
});
test("log out clears the token and protected pages redirect to login", async ({
  page,
}) => {
  const username = uniqueUsername();
  await register(page, username);
  await login(page, username);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});
