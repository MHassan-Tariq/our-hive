# Our Hive - Backend API

A robust community-focused platform designed to connect volunteers, participants, partners, and donors.

## Features

- **Centralized Authentication**: JWT-based login, registration, and role-based access control.
- **Cloud Storage**: Integrated with Cloudinary for persistent storage of all uploaded assets.
- **Email Services**: Automated email delivery for password resets and verification via Nodemailer.
- **Centralized Error Handling**: Standardized API responses with robust input validation.
- **Portal Management**: Dedicated workflows for Volunteers, Partners, Participants, and Admins.

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)
- Cloudinary Account
- Gmail/SMTP credentials

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Setup environment variables:
   ```bash
   cp .env.example .env
   # Update .env with your credentials
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

## Documentation

- **API Documentation**: See [SWAGGER_DOCS.md](file:///Users/user/Desktop/solinovation/our%20hive/SWAGGER_DOCS.md) for full endpoint details.
- **Admin Specifics**: See [ADMIN_API_DOCS.md](file:///Users/user/Desktop/solinovation/our%20hive/ADMIN_API_DOCS.md).
