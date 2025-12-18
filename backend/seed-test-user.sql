-- Create test organization (no isActive field in Organization entity)
INSERT INTO "organizations" (
  id, name, inn, kpp, address, "createdAt", "updatedAt"
) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440001', 
  'Test Organization', 
  '1234567890', 
  '123456789', 
  'Test Address', 
  NOW(), 
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create test user
-- Email: admin@example.com
-- Password: Admin123!
INSERT INTO "users" (
  id, email, "passwordHash", "fullName", role, "organizationId", "isActive", "createdAt", "updatedAt"
) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'admin@example.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Admin User',
  'admin',
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verify insert
SELECT email, "fullName", role FROM "users" WHERE email = 'admin@example.com';
