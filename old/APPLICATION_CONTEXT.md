# APPLICATION CONTEXT: waybill-app

This document provides a high-level overview of the "waybill-app" application, its purpose, architecture, and key features.

## 1. Application Purpose and Overview

The "waybill-app" is a comprehensive, multi-tenant logistics management platform designed for Russian businesses. Its primary goal is to streamline operations related to waybills (путевые листы), vehicle and driver management, and inventory control, ensuring compliance with relevant Russian regulations, particularly concerning strictly reported forms (БСО). It acts as a B2B SaaS solution for the logistics sector.

## 2. Architecture

The application follows a client-server architecture with a clear separation of concerns:

### 2.1. Frontend
*   **Technology Stack:** React 19, Vite (build tool), Tailwind CSS (styling).
*   **Description:** A modern Single-Page Application (SPA) providing a rich user interface for interacting with the backend services.

### 2.2. Backend
*   **Technology Stack:** Node.js, Express.js (web framework), TypeScript, Prisma ORM.
*   **Description:** A RESTful API server responsible for business logic, data persistence, and interaction with external services. It exposes various endpoints for managing resources and processes.
*   **Authentication:** JWT-based authentication with bcrypt for password hashing and a robust Role-Based Access Control (RBAC) system for managing user permissions.

### 2.3. Database
*   **Technology:** PostgreSQL.
*   **Description:** A relational database used as the primary data store. The database schema, defined via `prisma/schema.prisma`, is considered the "source of truth" for the application's business logic and data model.

### 2.4. Operating Modes
The application supports two operating modes:

- **Central Mode** - The dispatch/office mode:
  - All data is sourced from the backend API (Express + Prisma + PostgreSQL).
  - Full authentication/authorization and data isolation rules per organization/department apply.
  - Used for managing waybills, BSOs, inventory, directories, and reports.

- **Driver Mode** - A lightweight offline mode:
  - Data is stored locally in the browser (IndexedDB via LocalForage).
  - A mockApi is used as a local data source.
  - Suitable for scenarios where the backend is unavailable or not required (e.g., for a driver's local record-keeping).

## 3. Key Features

The "waybill-app" offers a wide range of functionalities to support logistics operations:

*   **Waybill Lifecycle Management:** Comprehensive tools for creating, editing, tracking the status, and finalizing waybills.
*   **Resource Management:**
    *   **Vehicles:** Management of vehicle profiles, including technical specifications and assignments.
    *   **Drivers:** Driver profiles, licenses, and assignments to vehicles/waybills.
    *   **Employees:** General employee management.
*   **Inventory Control:**
    *   **Stock Items:** Tracking of various items, particularly fuel.
    *   **Warehouses:** Management of storage locations.
    *   **Stock Movements:** Recording and tracking inventory ins and outs.
*   **AI-Powered Route Creation:**
    *   **Description:** Integrates the Google Gemini API to enable users to generate multi-stop route data from natural language prompts (e.g., "from warehouse to point A, then to point B"). This significantly simplifies route planning and data entry.
    *   **Implementation:** Client-side processing using `services/geminiService.ts`.
*   **Regulatory Compliance:**
    *   **Strictly Reported Forms (БСО):** Specific data models (`Blank`, `BlankBatch`) to manage and track sequentially numbered official forms as required by Russian regulations.
*   **Multi-tenancy:** Designed to support multiple organizations with isolated data.
*   **Testing and Verification:**
    *   **Unit/Integration Tests**:
        *   On the frontend: Vitest + Testing Library (for domain invariants, components, forms).
        *   On the backend: Unit/integration tests for auth, waybills, and inventory.
    *   **E2E Tests**:
        *   Playwright is used for end-to-end scenarios:
        *   login → create waybill → process → write off fuel from stock;
        *   BSO cycle: batch → issue → use in a waybill;
        *   checks for access control based on roles and departments.

## 4. Relevant Files and Directories

*   `package.json`: Frontend dependencies (React, Vite, Tailwind, @google/generative-ai) and scripts.
*   `backend/package.json`: Backend dependencies (Express.js, Prisma, pg).
*   `backend/prisma/schema.prisma`: Core database schema, business logic definition.
*   `backend/src/routes/`: Backend API endpoint definitions (e.g., `waybillRoutes.ts`, `vehicleRoutes.ts`).
*   `services/geminiService.ts`: Client-side logic for Google Gemini API integration (AI route generation).
*   `App.tsx`: Main entry point for the React frontend, defines UI structure and routing.

This context pack provides a foundational understanding of the "waybill-app" for developers, new team members, or anyone seeking a quick overview of the system.