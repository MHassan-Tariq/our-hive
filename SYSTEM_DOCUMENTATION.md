# Our Hive Detailed System Documentation

## 1. System Overview & Architecture
Our Hive is a robust community-focused platform built as a distributed client-server application. It bridges the gap between various stakeholders within a community ecosystem: Volunteers, Participants, Partners, Donors/Sponsors, and Admins.

The application implements specialized schemas for various user archetypes, converging on a root `User` document via Mongoose ObjectId references.

| Layer | Component | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React / Tailwind CSS | User interface and dashboard metrics display. |
| **Application Interface**| Express Router & Middleware | Process incoming payloads, validate consistency, and dispatch mail/storage calls. |
| **Database** | MongoDB (via Mongoose) | Persistent object storage for profiles, logs, and ledger metrics. |
| **File Storage** | Cloudinary | Media warehousing for secure uploads (documents, logos, images). |

---

## 2. Technology Stack

### Backend Engine (`our hive`)
*   **Runtime & Framework**: Node.js 22+ with Express (v5.2.1)
*   **Database**: MongoDB with Mongoose ODM (v9.2.1)
*   **Security & Auth**: JSON Web Tokens (JWT) & bcryptjs
*   **File Management**: Multer coupled with Cloudinary Storage
*   **Mailing Service**: Nodemailer
*   **API Documentation**: Swagger (`swagger-ui-express`)

### Frontend Administration Portal (`our hive admin`)
*   **Framework**: React v19.2.0
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS v4.2
*   **Routing**: React Router DOM v7
*   **Network Layer**: Axios
*   **Visuals**: Lucide Icons & React Hot Toast

---

## 3. Setup Instructions

### Setting Up The Backend API
1.  Navigate to backend root directory.
2.  Install dependencies: `npm install`
3.  Configure `.env` with required database URLs and API secret keys.
4.  Run Server: `npm run dev`

### Setting Up The Admin Dashboard
1.  Navigate to admin root directory.
2.  Install dependencies: `npm install`
3.  Configure `.env` targeting your local `VITE_API_URL`.
4.  Run Server: `npm run dev` (Launches on default `http://localhost:5173`).

---

## 4. API Reference (Core Endpoints)

### Authentication (`/api/auth`)
*   `POST /register`: Basic identity establishment.
*   `POST /volunteer-register`: Complex ingestion handling base64 or multipart document pipes for ID verification.
*   `POST /partner-register`: Focused on onboarding business/nonprofit entities.
*   `POST /login`: Yields a JWT enabling resource access across higher level layers.

### Admin Actions (`/api/admin`)
*   `GET /dashboard`: High-level overview analytics of platform usage metrics.
*   `PATCH /partners/:id/status`: Master toggle controls for administrative review.
*   `PATCH /volunteer/add-hours/:id`: Forced accounting of community credits.
*   `GET /participants/export`: Instant memory streaming conversion into downlodable CSV metrics.

### Donations Engine (`/api/donations`)
*   `POST /`: Offer non-monetary assets (Food, Clothing, etc) including Cloudinary upload pipes.
*   `POST /monetary`: Ledger entry hooks for financial contributions.
*   `POST /webhooks/zeffy`: Trigger listener consuming events pushed directly from secure stripe/zapier routing.

---

## 5. Frontend Module Map (`our hive admin/src/pages/`)

*   `Dashboard.jsx`: High density summary layout showing the main KPIs of system status.
*   `Volunteers.jsx` / `VolunteerDetail.jsx`: Grid layouts listing valid users mapping directly through tracking interfaces.
*   `Participants.jsx`: Registry detailing individuals under care with housing analytics views.
*   `Partners.jsx` / `Sponsors.jsx`: Corporate client dashboard views.
*   `Donations.jsx`: Live workflow grid tracking logistical states of physical asset pickups.

---

## 6. Security Policies
1.  **Stateless ACL**: Resource access explicitly gated via JWT verification middleware.
2.  **RBAC Enforcement**: Routes apply specific filters enforcing that only required role identifiers (`admin`, `volunteer`, `partner`) may pass control flows.
3.  **Audit Logs**: System modification commands automatically trigger an insertion into the `ActivityLog` collection for auditability.
