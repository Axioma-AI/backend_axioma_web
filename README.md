# Backend Axioma Web

<p align="center">Production-ready authentication and user management API for Node.js + TypeScript.</p>

![S3](https://img.shields.io/badge/S3-Amazon%20S3-569A31?logo=amazon-s3&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-Amazon%20Web%20Services-232F3E?logo=amazon-aws&logoColor=white) ![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-85EA2D?logo=swagger&logoColor=white) ![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-6BA539?logo=openapi-initiative&logoColor=white) ![MySql](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white) ![Express](https://img.shields.io/badge/Express-5-black?logo=express&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-JSON%20Web%20Token-000000?logo=json-web-tokens&logoColor=white)

Production-ready authentication and user management API using Node.js, Express 5, and TypeScript. It includes user registration, login, logout, JWT-based access tokens, session persistence, profile management with avatar support, two-factor authentication (2FA), personal access tokens, and OpenAPI documentation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Docs Authentication](#docs-authentication)
  - [CORS](#cors)
- [Prisma Workflow](#prisma-workflow)
  - [Model to Database](#model-to-database)
  - [Database to Model](#database-to-model)
  - [Test data seed](#test-data-seed)
- [Documentation](#documentation)
- [Development Scripts](#development-scripts)
- [Folder Structure](#folder-structure)
- [Notes](#notes)
- [License](#license)
- [Author](#author)

## Overview

This project provides a secure, extensible authentication and user management backend. It uses Prisma for database access and Express 5 for routing. The API exposes endpoints for user registration, login, logout, personal tokens, profile management (including avatar), two-factor authentication (2FA), and serves OpenAPI docs.

## Features

- TypeScript-first Node.js API using `express@5`
- Prisma Client for schema-driven DB access
- Secure password hashing with Argon2 and password history for secure recovery
- JWT generation and verification using `jose`
- Session and token tracking with `jti` and revocation on logout
- Structured logging to console and `logs/` with `winston`
- CORS configuration with open or restricted modes
- Swagger/OpenAPI docs at `/back-end/axioma-web/docs` and `/back-end/axioma-web/openapi.json`
- Alternative Redoc UI at `/back-end/axioma-web/redoc`
- Personal access tokens (API Keys): create, list and revoke with expiry presets
- Profile updates support avatar upload with automatic image type detection; optional text fields may be omitted
- Two-factor authentication (2FA) with TOTP, setup/verify/disable and recovery codes
- Health check endpoint at `/health`
- Interests & Groups with seat quotas and admin pool management (pool=20), including auto‑recharge for admin and detailed seats summary endpoints

## Tech Stack

- Runtime: `Node.js`
- Framework: `Express`
- Language: `TypeScript`
- DB: `MySQL` with `Prisma` ORM
- Auth: `jose` (JWT), `argon2`
- Docs: `swagger-jsdoc`, `swagger-ui-express`
- Logging: `winston`, `chalk`

## Seats & Interests

Seats enable a controlled number of user “interests” per account, with extra administration capabilities:

- Core concepts
  - Each user has `seats_quota`; each interest consumes one seat.
  - Admins have a total pool of 20 seats shared between their own `seats_quota` and the `seats_quota` of users they created.
  - Auto‑recharge for admin: when an admin reduces a created user’s `seats_quota` via the assignment endpoint, the freed seats are automatically added to the admin’s `seats_quota` in the same transaction.
  - Auto‑allocation on interest creation (admin self): if the authenticated user is an admin and their `seats_quota` is exhausted but the pool still has remaining seats, creating an interest automatically grants +1 to the admin’s `seats_quota` and proceeds.

- User endpoints
  - POST `/api/v1/interests` — Create interest (limits: `seats_quota`; auto‑allocation for admin self applies).
  - DELETE `/api/v1/interests/{interestId}` — Delete interest (enforces that any group retains ≥ 2 interests).
  - GET `/api/v1/interests/summary` — Seats and items summary; returns
    - `seats_quota`, `seats_used`, `seats_remaining`
    - `interests`: [{ id, name }]
    - `groups`: [{ id, name, interests: [{ id, name }] }]
  - POST `/api/v1/interests/groups` — Create group for the authenticated user with at least 2 interests. Optional `interest_names` will be created if seats are available.
  - POST `/api/v1/interests/groups/{groupId}/items` — Add interest by `interest_id` or `interest_name` (creates if missing and seats available).
  - DELETE `/api/v1/interests/groups/{groupId}` — Delete a group.
  - DELETE `/api/v1/interests/groups/{groupId}/items/{interestId}` — Remove interest from group (group must keep ≥ 2 interests).

- Admin endpoints
  - GET `/api/v1/admin/users` — List users created by the admin; includes `seats_quota`.
  - GET `/api/v1/admin/users/seats` — Admin pool summary: total=20, assigned to users, admin seats quota, admin seats used, overall remaining, admin remaining.
  - POST `/api/v1/admin/users/seats` — Assign `seats_quota` to a user by `id` OR `email` OR `username` (includes assigning to yourself):
    - Keeps the total pool ≤ 20.
    - Auto‑recharge: reducing a created user’s quota increases the admin’s `seats_quota` by the freed amount atomically.
  - GET `/api/v1/admin/users/summary` — Seats, interests and groups for a specific user (must be created by the admin).
  - POST `/api/v1/admin/interests` — Create interest for a user created by the admin; respects `seats_quota`.
  - DELETE `/api/v1/admin/interests/{interestId}` — Delete a user’s interest with group constraints (admin).
  - POST `/api/v1/admin/interests/groups` — Create group for a user; optional `interest_names` created if seats allow.
  - POST `/api/v1/admin/interests/groups/{groupId}/items` — Add or create interest into a group for that user.
  - DELETE `/api/v1/admin/interests/groups/{groupId}` — Delete user’s group (admin).

- Request formats
  - `interest_names` accepts either an array of strings or a comma‑separated string in both JSON and multipart/form‑data. Example JSON:

    ```json
    { "name": "politics", "interest_names": ["Evo Morales", "Medina", "SAMUEL"] }
    ```

    Example multipart (single CSV field): `interest_names="Evo Morales, Medina, SAMUEL"`

- Error handling
  - Validation uses Zod; invalid input returns HTTP 400 with descriptive messages.
  - Database errors are sanitized into friendly API responses.

## Prerequisites

- Node.js v18+ installed
- MySQL reachable with credentials defined in `.env`
- An AWS account with S3 bucket and IAM user credentials 

## Quick Start

1. Clone the repository:
   ```sh
   git clone <your-repo-url>.git
   cd backend_axioma_web
   ```
2. Copy the example environment file and edit values:
   ```sh
   cp .env.example .env
   ```
   - Set:
      - App Configuration
      ```env
     # App configuration
     SERVICE_NAME=Backend Axioma Web - TypeScript
      VERSION=local
      LOG_LEVEL=DEBUG
      PORT=3000
      ```
      - DB Configuration
      ```env
      # DB configuration
      DB_HOST=localhost
      DB_USER=root
      DB_PASSWORD=root
      DB_PORT=3306
      ```
      - JWT Configuration
      ```env
      # JWT configuration
      # Allowed algorithms: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA
      # HMAC (HS*) setup:
      JWT_SECRET=changeme
      # Use a strong, high‑entropy secret (>=32 chars). Example generator:
      # openssl rand -base64 32
      JWT_ALGORITHM=HS256
      # Asymmetric (RS*/PS*/ES*/EdDSA) setup:
      # JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      # JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
      JWT_EXPIRATION_MINUTES=60
      JWT_REFRESH_EXPIRATION_MINUTES=10080
      JWT_ISSUER=http://localhost:3000 
      JWT_AUDIENCE=http://localhost:3000
      # Backend base URL for docs and clients
      # Development: http://localhost:3000
      # Staging:     https://api.staging.your-domain.com
      # Production:  https://api.your-domain.com
      API_BASE_URL=http://localhost:3000
      ```
      - Cors Configuration
      ```env
      # Cors configuration
      ALLOWED_ORIGINS=all
      # To allow origins you could use 
      # "all" to allow all origins
      # "limited" to allow only the ones specified in the list located in src/config/cors_config.ts
      ```
      - Admin User
      ```env
      # Admin user
      SERVICE_USER=admin
      SERVICE_USER_PASS=AdminPassword159@!
      SERVICE_USER_EMAIL=admin@example.com
      ```
   
3. Install dependencies:
   ```sh
   npm install
   ```
4. Run in development:
   ```sh
   npm run dev
   ```
5. Build and run in production:
   ```sh
    npm run build
    npm start
    ```
The server listens on `http://localhost:<PORT>` (default `3000`).

## Configuration

### Environment Variables

- `SERVICE_NAME`: Display name
- `VERSION`: Build/version label shown in docs
- `LOG_LEVEL`: `DEBUG`, `INFO`, `WARN`, `ERROR`
- `PORT`: Server port
- `API_BASE_URL`: Base URL used to populate Swagger/OpenAPI servers. In production, set to an HTTPS URL to avoid mixed content/CORS issues. When not localhost, the docs include both the production server and the local server.
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `DB_NAME`: MySQL settings used by Prisma
- `DATABASE_URL`: Full connection string for Prisma (recommended). The Prisma schema reads `env("DATABASE_URL")`.
- `JWT_SECRET`: Strong secret; generate with `openssl rand -base64 32`
- `JWT_ALGORITHM`: `HS256/384/512`, `RS256/384/512`, `PS256/384/512`, `ES256/384/512`, `EdDSA`
- `JWT_EXPIRATION_MINUTES`: Access token TTL
- `JWT_REFRESH_EXPIRATION_MINUTES`: Refresh token TTL
- `JWT_ISSUER`: Token issuer
- `JWT_AUDIENCE`: Token audience
- `JWT_PRIVATE_KEY`: PEM private key for RS*/PS*/ES*/EdDSA (required for asymmetric)
- `JWT_PUBLIC_KEY`: PEM public key for RS*/PS*/ES*/EdDSA (required for asymmetric)
- `ALLOWED_ORIGINS`: `all` or `limited`
- `SWAGGER_USER`: Username for basic auth to access API docs
- `SWAGGER_PASSWORD`: Password for basic auth to access API docs
- `AWS_DEFAULT_REGION`: AWS region for S3 operations
- `AWS_ACCESS_KEY_ID`: AWS access key for S3 operations
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3 operations
- `AWS_BUCKET_NAME`: S3 bucket used to store media (e.g., avatars)
- `AWS_S3_ROOT_PREFIX`: Root prefix within the S3 bucket (no leading/trailing slashes). Default is `optimus`.
- `PRISMA_RUN_SEED`: If `true`, runs Prisma seed on startup (development only)

### Docs Authentication

API documentation is protected with HTTP Basic Auth.

- `SWAGGER_USER`: Docs auth username (required in production) (default: `admin`)
- `SWAGGER_PASSWORD`: Docs auth password (required in production) (default: `admin123`)

! **Note**: The default credentials are for development purposes only. In production, set custom values for `SWAGGER_USER` and `SWAGGER_PASSWORD`.

Docs endpoints:

- Swagger UI: `/back-end/axioma-web/docs`
- OpenAPI JSON: `/back-end/axioma-web/openapi.json`
- Redoc UI: `/back-end/axioma-web/redoc`

### CORS

Set `ALLOWED_ORIGINS=all` to allow any origin or `limited` to restrict. If `limited`, update the whitelist in `src/config/cors_config.ts`.

## Prisma Workflow

The Prisma schema references `env("DATABASE_URL")`. Credentials should be set in `.env` and never hardcoded in `schema.prisma`.

### Model to Database

- Edit models in `prisma/schema.prisma`
- Apply changes: `npm run prisma:migrate` (or `npm run prisma:push`)
- Regenerate client: `npm run prisma:generate`

### Database to Model

- Introspect: `npm run prisma:pull`
- Regenerate client: `npm run prisma:generate`

### Test data seed

- The project includes a Prisma seed defined in [seed.ts](prisma/seed.ts).
- The configuration in [package.json](package.json) is:

  ```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
  ```

- The [prisma-sync.js](scripts/prisma-sync.js) script runs before `npm run dev` and `npm start` (via `predev`/`prestart`) and performs:
  - Build `DATABASE_URL` from the app settings.
  - Run `npx prisma db push` (schema sync without migrations).
  - Run `npx prisma generate`.
  - Run `npx prisma db seed`.

- The seed is idempotent: if records already exist (for example, user `admin@example.com`), they are not duplicated.

**Data created by the seed (development only):**

- Basic structure:
  - `organization`: `Test Org`
  - `city`: `Test City`
  - `company`: `Test Company` (linked to `Test Org`)
  - `department`: `Technology` (linked to `Test Company`)
- Roles:
  - Ensures at least `admin` and `member` roles exist in the `roles` table.
- Users:
  - Admin:
    - Email: `admin@example.com`
    - Username: `admin`
    - Password: `MyPassw0rd!`
    - Role: `admin`
    - Phone: `+52 5551110001`
  - Member:
    - Email: `member@example.com`
    - Username: `member`
    - Password: `MyPassw0rd!`
    - Role: `member`
    - Phone: `+52 5551110002`
- Profile (for both users, useful to test Forgot Password):
  - `organization`: `Test Org`
  - `company`: `Test Company`
  - `department`: `Technology`
  - `city`: `Test City`
- Password history (`user_password_history`):
  - `MyPassw0rd!-1`
  - `MyPassw0rd!-2`
  - `MyPassw0rd!-3`
  - `MyPassw0rd!-4`

The seed **does not** create 2FA data, personal tokens or avatars; those flows are tested manually using the corresponding endpoints.

### Notes on personal tokens schema

- `personal_access_tokens.expires_at` is required and stored as `@db.DateTime(6)` for microsecond precision, aligned with `created_at`/`updated_at`.
- `personal_access_tokens.revoked_at` is optional and set when a token is revoked.
- `personal_access_tokens.expires_preset` uses a Prisma enum (`personal_token_expiry_preset`) whose values are `ONE_WEEK`, `ONE_MONTH`, `THREE_MONTHS`, `SIX_MONTHS`, `ONE_YEAR`. These enum values are mapped to human-readable strings via `@map("1_week")`, etc.
- The application accepts human-readable presets (`1_week`, `1_month`, `3_months`, `6_months`, `1_year`) and maps them to the Prisma enum internally.

## Documentation

The root README intentionally stays concise. Full endpoint‑level documentation
is available under the `docs/` folder.

- Project documentation index: [`docs/README.md`](docs/README.md)

The API is also documented via OpenAPI/Swagger at:

- Swagger UI: `/back-end/axioma-web/docs`
- OpenAPI JSON: `/back-end/axioma-web/openapi.json`
- Redoc UI: `/back-end/axioma-web/redoc`

## Development Scripts

- `npm run dev` — Development with hot-reload (runs Prisma helpers before start)
- `npm run build` — Compile TypeScript to `dist/`
- `npm start` — Run compiled server
- Prisma helpers:
  - `npm run prisma:generate` — Generate Prisma Client
  - `npm run prisma:studio` — Open Prisma Studio
  - `npm run prisma:migrate` — Create/apply migrations
  - `npm run prisma:push` — Push schema state
  - `npm run prisma:pull` — Introspect DB
  - `npm run prisma:validate` — Validate schema

## Folder Structure

```
src/
├── config/
├── middlewares/
├── repositories/
│   ├── auth/
│   ├── committees/
│   ├── common/
│   ├── company/
│   ├── department/
│   ├── employee/
│   ├── organization/
│   ├── profile/
│   └── two_factor/
│
├── routes/
│   └── api/
│       └── v1/
│           ├── auth/
│           ├── committees/
│           ├── company/
│           ├── company_phones/
│           ├── department/
│           ├── employee/
│           ├── organization/
│           ├── profile/
│           └── two_factor/
│
├── schemas/
│   ├── auth/
│   │   ├── common/
│   │   ├── forgot_password/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── register/
│   │   ├── token_login/
│   │   ├── two_factor_login/
│   │   └── personal_token/
│   │
│   ├── committees/
│   ├── common/
│   ├── company/
│   ├── department/
│   ├── employee/
│   ├── media/
│   ├── organization/
│   ├── profile/
│   └── two_factor/
│
├── services/
│   ├── auth/
│   ├── committees/
│   ├── company/
│   ├── department/
│   ├── employee/
│   ├── organization/
│   ├── profile/
│   └── two_factor/
│
├── utils/
│
└── models/
    ├── prisma/
    └── database/
        └── dbName/
```

## Notes

- Do not hardcode credentials in `prisma/schema.prisma`. Use `env("DATABASE_URL")`.
- JWT hardening:
  - Strong HMAC secrets only (>=32 chars, no weak values like `changeme`, `secret`).
  - Strict algorithm whitelist; tokens are verified against fixed `iss` and `aud`.
  - Minimal access token payload: `sub`, `role_id`, `jti`; `two_factor_pending` solo si aplica.
  - Refresh tokens are stored in HttpOnly, Secure, SameSite=strict cookies and rotated on use; reuse of revoked tokens revokes all active sessions.
- Set `ALLOWED_ORIGINS=limited` for production and update the whitelist.
- Logs are written to `logs/` per file (e.g., `login_service.log`).
- Set `SWAGGER_USER` and `SWAGGER_PASSWORD` for production.

## License

This project is licensed under a dual license model.  
See the [LICENSE](LICENSE) file for details.

## Author

<table align="center">
  <tr>
    <!-- Joseph -->
    <td align="center" style="padding:20px;">
      <a href="https://github.com/ElJoamy">
        <img src="https://avatars.githubusercontent.com/u/68487005?v=4"
             width="90"
             alt="ElJoamy"
             style="border-radius:50%" />
        <br />
        <sub><b>Joseph Meneses (ElJoamy)</b></sub>
      </a>
      <br />
      <span style="font-size:13px;">
        Backend and AI Developer · Cybersecurity Engineer · DBA
      </span>
      <br /><br />
      <a href="https://linkedin.com/in/joamy5902">
        <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" />
      </a>
      <a href="https://github.com/ElJoamy">
        <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" />
      </a>
    </td>
  </tr>
</table>
