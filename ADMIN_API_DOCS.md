# Admin Panel API Documentation & Workflow

This document provides a detailed overview of the CRUD APIs and working workflows implemented for the Admin Portal of the "Our Hive" application. All endpoints require an administrative JWT token (`Bearer <token>`).

---

## 1. Dashboard Overview

**Endpoint:** `GET /api/admin/dashboard`

**Working Flow:**
When the admin first logs in, the dashboard aggregates data from across the system to provide a high-level overview.

- **Stat Cards:** Calculates `totalParticipants`, `totalVolunteers`, `totalPartners`, `pendingApprovals` (Partner role), `pendingDonations` (Donor role), and `activeCampaigns`.
- **Recent Activity Feed:** Queries the latest 10 `ActivityLog` entries. Logs are automatically generated across the system (e.g., when an opportunity is approved, a donation status changes, or a new user registers).
- **Active CampaignWidget:** Finds an active campaign with a goal (`goalAmount > 0`), calculates the `percentageReached`, and the `daysRemaining` based on the `goalDeadline`.
- **Search:** Supports a `?search=` query parameter to look up campaigns directly from the dashboard header.

---

## 2. Participant Management (List & Details)

### Participant Data Model Updates

To support the admin screens, the `ParticipantProfile` schema was extended to include:

- `gender`, `raceEthnicity`, `primaryLanguage`
- `accountStatus`: Enum mapping to UI badges (`ACTIVE`, `STABLE`, `IN PROGRESS`, `URGENT`, `INACTIVE`).

### API Endpoints

#### A. List Participants

**Endpoint:** `GET /api/admin/participants`

- **Workflow:** Renders the main Participants table.
- **Features:**
  - **Pagination:** Uses `?page=` and `?limit=` query params.
  - **Search:** `?search=John` filters by First Name, Last Name, or Email across linked `User` accounts.
  - **Filtering:** `?status=ACTIVE` or `?housingStatus=Waitlisted`.

#### B. Export CSV

**Endpoint:** `GET /api/admin/participants/export`

- **Workflow:** Triggered by the "Export CSV" button. Compiles all participants and generates a downloadable CSV file containing names, contact info, housing status, intake progress, and registration dates.

#### C. Get Single Participant Detail

**Endpoint:** `GET /api/admin/participants/:id`

- **Workflow:** Renders the deep-dive detail screen. Joins the `ParticipantProfile` with the `User` document to return all Basic Information, Current Residence, Demographics, and Intake status in one payload.

#### D. Edit Profile (Update)

**Endpoint:** `PATCH /api/admin/participants/:id`

- **Workflow:** Triggered by the "Edit" button. Allows the admin to overwrite demographic data, housing status, and language preferences.

#### E. Deactivate Account

**Endpoint:** `PATCH /api/admin/participants/:id/deactivate`

- **Workflow:** Triggered by the "Deactivate" UI button. Explicitly transitions the user's `accountStatus` to `INACTIVE` rather than safely deleting the record, preserving historical data.

---

## 3. In-Kind Donations Management

### Donation Data Model Updates

To match the logistics UI, `InKindDonation` was updated:

- `deliveryMethod` supports `Courier`, `Shipping`, `pickup`, and `drop-off`.
- `storageDetails` supports `room`, `rack`, `shelf`, and the added `floor` property.
- `petInfo` handles the "Pet Exposure" requirements (`hasCat`, `hasDog`).

### API Endpoints

#### A. List Donations & Logistics Stats

**Endpoint:** `GET /api/admin/in-kind-donations`

- **Workflow:** Renders the In-Kind Donors screen.
- **Features:**
  - **Table Data:** Returns donor names, item details, pet exposure, delivery method, and status. Supports pagination (`?page=`, `?limit=`).
  - **Dynamic Top Stats:** Simultaneously calculates the three header widgets:
    1. **Pending Review:** Count of donations with `status: 'pending'`.
    2. **Approved This Week:** Count of donations approved since the start of the current week.
    3. **Scheduled Pickups Today:** Count of donations where the `pickupDate` falls between 00:00 and 23:59 of today.

#### B. Export CSV

**Endpoint:** `GET /api/admin/in-kind-donations/export`

- **Workflow:** Downloads the logistics manifest, joining donor details with item categorization, quantities, and warehouse destination slots.

#### C. Get Single Donation Detail

**Endpoint:** `GET /api/admin/in-kind-donations/:id`

- **Workflow:** Fetches the granular detail view (e.g., `Donation #ID-8829`), retrieving the item category, estimated value, mapped delivery schedules, and destination assignment blocks.

#### D. Update Status & Destination (Approve / Reject / Assign)

**Endpoint:** `PATCH /api/admin/in-kind-donations/:id/status`

- **Workflow:** This multi-functional endpoint powers several UI workflows on the detail screen:
  - **Approve/Reject:** Changes the status. If rejected, accepts a `rejectionReason`.
  - **Destination Assignment:** Accepts `locationName` (e.g., "Main Shelter") and granular slots (`storageRoom`, `storageRack`, `storageShelf`, `storageFloor`).
  - **Activity Logging:** Automatically generates an `ActivityLog` entry so the participant is notified that their donation status has advanced.
