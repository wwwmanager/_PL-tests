-- Update password hash for test user
-- New password: password
UPDATE "users" 
SET "passwordHash" = '$2b$10$7iT2rdj5NV/AkZY3oWn.2.jdzXK2tLRE4kQap5qEWkirEmqV0w9G2' 
WHERE email = 'admin@example.com';

-- Verify
SELECT email, "fullName", role FROM "users" WHERE email = 'admin@example.com';
