# docker-banksajt

A Dockerized bank site: Next.js frontend, Express backend, MySQL database, orchestrated with Docker Compose and deployed on an EC2 instance behind nginx.

**Live site:** http://16.171.185.223

## Stack

- `frontend/` — Next.js (register, login, account/deposit pages)
- `backend/` — Express, talks to MySQL via `mysql2`
- `database/init.sql` — schema (`users`, `accounts`, `sessions`)
- `docker-compose.yml` — runs all three services together

## Running locally

```
docker compose up -d --build
```

- Frontend: http://localhost:3002
- Backend: http://localhost:3003
