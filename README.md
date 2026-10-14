# docker-banksajt

A Dockerized bank site: Next.js frontend, Express backend, MySQL database, orchestrated with Docker Compose and deployed on an EC2 instance behind nginx.

**Live site:** http://16.171.185.223

**Green Actions:** https://github.com/ImperialFiddlesticks/docker-banksajt/actions/runs/38534495537

## Stack

- `frontend/` — Next.js (register, login, account/deposit pages)
- `backend/` — Express, talks to MySQL via `mysql2`
- `database/init.sql` — schema (`users`, `accounts`, `transactions`). Passwords are stored as bcrypt hashes in `users.password_hash`.
- `docker-compose.yml` — runs all three services together

## Authentication

Login uses a JWT stored in an `httpOnly` cookie. The frontend never sees the token.

```
Log in (POST /sessions)
    ↓
Express checks the password with bcrypt, creates a JWT (sub = user id, expires in 15 min)
    ↓
Express sends Set-Cookie: access_token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=900
    ↓
The browser stores the cookie and sends it automatically (fetch with credentials: "include")
    ↓
requireAuth reads req.cookies.access_token, verifies the JWT and sets req.userId
```

- `POST /logout` clears the cookie with the same settings it was created with.
- CORS only allows the exact frontend origin (`FRONTEND_ORIGIN`) with `credentials: true`, never `*`.
- The cookie's `secure` flag is controlled by `COOKIE_SECURE`. It is `false` by default because the deployed site currently runs on plain HTTP, and browsers do not store `Secure` cookies over HTTP. Set `COOKIE_SECURE=true` once the site is served over HTTPS.

## Running locally

1. Create a `.env` file in the project root (next to `docker-compose.yml`). It is ignored by Git.

   ```
   JWT_SECRET=<a random value of at least 32 bytes>
   ```

   Generate a value with:

   ```
   openssl rand -hex 32
   ```

   or, if `openssl` is not available:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Start the stack:

   ```
   docker compose up -d --build --wait
   ```

   If you have an old database from before password hashing was added, reset it first with `docker compose down -v`. This deletes all data, and `database/init.sql` runs again on the next start.

- Frontend: http://127.0.0.1:3002
- Backend: http://127.0.0.1:3003

Open the frontend at `127.0.0.1`, not `localhost`. The browser treats them as different origins, and the backend's CORS setting only allows `http://127.0.0.1:3002` by default.

## Environment variables

| Variable                    | Where                  | Required | Description                                                                                                                                       |
| --------------------------- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                | `.env` in project root | Yes      | Key used to sign and verify JWTs. At least 32 bytes. The backend refuses to start without it. Use a different value locally, in tests and on EC2. |
| `NEXT_PUBLIC_API_URL`       | `.env` in project root | No       | Backend URL used by the frontend. Defaults to `http://127.0.0.1:3003`.                                                                            |
| `NEXT_PUBLIC_FEATURE_PROMO` | `.env` in project root | No       | Feature flag for the promo banner. Defaults to `false`.                                                                                           |
| `FRONTEND_ORIGIN`           | `.env` in project root | No       | The exact frontend origin allowed by CORS (no trailing slash). Defaults to `http://127.0.0.1:3002`.                                               |
| `COOKIE_SECURE`             | `.env` in project root | No       | Set to `true` to give the login cookie the `Secure` flag. Only use it when the site runs over HTTPS. Defaults to `false`.                          |

The database variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD` and so on) are set in `docker-compose.yml`.

### GitHub Actions secrets

| Secret            | Used for                                                 |
| ----------------- | -------------------------------------------------------- |
| `TEST_JWT_SECRET` | `JWT_SECRET` for the e2e test stack. Only used in tests. |
| `EC2_HOST`        | Address of the EC2 server                                |
| `EC2_USER`        | SSH user on the EC2 server                               |
| `EC2_SSH_KEY`     | Private SSH key used by the deploy job                   |

### EC2

The server has its own `.env` file in the project folder (not in Git, `chmod 600`) with:

- `JWT_SECRET`: its own random value, different from the local and test values
- `NEXT_PUBLIC_API_URL=http://16.171.185.223:3003`
- `FRONTEND_ORIGIN=http://16.171.185.223`

`COOKIE_SECURE` is not set there, because the site does not use HTTPS yet.

## Running the tests

**Backend unit tests (Vitest):**

```
cd backend
npm install
npm test
```

**End-to-end tests (Playwright):** the Docker stack must be running first (see above).

```
cd frontend
npm install
npx playwright install chromium
npm run test:e2e
```

The e2e tests cover registration, login, deposits, withdrawals and log out. They also check that:

- login sets an `httpOnly`, `SameSite=Lax` cookie and returns no token in the JSON
- a logged-in user can fetch their account via the cookie, while a missing or tampered cookie gets `401`
- JavaScript on the page cannot read the cookie (`document.cookie`)
- after logging out, the cookie is gone and the account can no longer be fetched in the same browser
- a wrong password gives neither a token nor a cookie

`npx playwright install chromium` is only needed the first time.

## Security questions

**1. Why can you read a JWT payload without the signing key, and what does the signature protect?**

The payload is only encoded, not encrypted, so anyone who has the token can decode and read it. The signature is created with the server's secret key, so if someone changes the payload the server notices because the signature no longer matches the content, and only someone with the secret could create a new valid signature. The signature does not protect against someone reading the payload, so you must never put secret or sensitive data (passwords, personal ID numbers, bank details) in the payload.

**2. What happens if someone steals a valid token before it expires? Does the signature stop that person?**

They can use it to act as the user (make changes to the account, withdrawals etc.) until it expires, because the server only checks that the token is genuine and not expired, not who it is coming from. The signature does not stop them because the stolen token has not been changed. It is a real token signed by the server so the signature is still valid. The limit is the short lifespan of the token (15min). After that the token stops working.

**3. What is the difference between hashing a password and signing a token?**

Hashing a password is one-way: the password is turned into a hash that cannot be turned back into the password. It is used to store passwords safely. At login the password is hashed again and compared with the stored hash so the real password never needs to be saved. Hashing does not use a secret key. Signing a token does not hide the content, the payload stays readable. Instead, a signature is created with a secret key, which proves the token was created by our server and has not been changed.

**4. What is the risk of storing a token in localStorage if the site has an XSS vulnerability?**

XSS means an attacker manages to run their own Javascript on our site. Any JavaScript running on the page can read localStorage, meaning the attacker's script could read any token found within and send it to their own server. The attacker can then use that token to act as the user from their own computer, see the balance, make deposits and withdrawals etc. Tokens in localstorage also stay after the tab is closed which gives more time to steal them. That is why our app stores the token in an `httpOnly` cookie instead: JavaScript, including an attacker's script, cannot read it at all.

**5. Why can't the server automatically know that a JWT should stop working when the user clicks Log out?**

A JWT is stateless. The server does not store the tokens it has issued. When a request comes in, jwt.verify only checks the signature, the issuer and the expiry time, all of which are inside the token itself. So when the user clicks Log out, `POST /logout` only tells the browser to delete the cookie. The token itself is not revoked, because the server has no list to remove it from. A copy of the token would still be accepted until it expires. To revoke JWTs the server would need to store something again, or rely on a short expiry time like our 15 minutes.

**6. Which secrets are in your project, and where should they be stored locally, in GitHub Actions and on EC2?**

The secrets in our project are:

- **`JWT_SECRET`**: signs and verifies JWTs. If it leaked, anyone could create tokens for any user. We use three different values:
  - locally in `.env` in the project root (ignored by Git)
  - in GitHub Actions as the GitHub Secret `TEST_JWT_SECRET`, used only for tests
  - on EC2 in a `.env` file on the server (`chmod 600`)
- **The SSH key for EC2**: stored locally outside the project folder, and in GitHub Actions as the GitHub Secret `EC2_SSH_KEY` for the deploy job.
- **`EC2_HOST` and `EC2_USER`**: stored as GitHub Secrets.
- **Database passwords**: currently written in `docker-compose.yml`, which is committed to Git. This is OK for our local test database, but they should be moved to `.env` (and GitHub Secrets / the EC2 `.env`), like `JWT_SECRET`.

Secrets are never written in the code, in Git, in the README or in logs. They are given to the app as environment variables. User passwords are not stored at all, only as bcrypt hashes. Variables starting with `NEXT_PUBLIC_` are sent to the browser, so they must never contain secrets.
