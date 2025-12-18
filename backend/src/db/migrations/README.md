# 🗄️ Database Migration: Add Role to Users

## Created Files

### 1. Migration File
**Path:** `src/db/migrations/1732895086000-AddRoleToUsers.ts`

Adds `role` column to `users` table:
- Type: `text`
- Default: `'user'`
- Nullable: `false`

### 2. Seed Script
**Path:** `src/db/seed.ts`

Creates test admin user:
- Email: `admin@example.com`
- Password: `admin123`
- Role: `admin`

### 3. Updated Files
- `src/db/data-source.ts` - Added migrations config
- `package.json` - Added migration scripts

---

## 🚀 How to Run

### Option 1: Auto-sync (Development - Current)
Backend already configured with `synchronize: true`, so the `role` field will be auto-created on next server start:

```bash
cd backend
npm run dev
```

### Option 2: Manual Migration (Production-ready)
For production or controlled migrations:

```bash
cd backend

# Run migration
npm run typeorm:migration:run

# Seed admin user
npm run typeorm:seed
```

---

## ✅ Verification

After running seed:
1. Login at frontend with `admin@example.com` / `admin123`
2. Check user has `role: 'admin'` in JWT token
3. Verify admin panel access

---

## 📝 Notes

- Migration is **optional** in dev due to `synchronize: true`
- For production, set `synchronize: false` and use migrations
- Seed script is **idempotent** (won't create duplicate admin)
