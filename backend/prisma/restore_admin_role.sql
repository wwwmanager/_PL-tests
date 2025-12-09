-- Script to restore admin user role after database reset
-- Run with: psql -U postgres -d waybills -f restore_admin_role.sql

INSERT INTO user_roles ("userId", "roleId")
SELECT u.id, r.id 
FROM users u, roles r 
WHERE u.email = 'admin' AND r.code = 'admin'
ON CONFLICT DO NOTHING;
