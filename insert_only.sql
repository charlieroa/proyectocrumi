INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role_id, phone, status)
VALUES (1, 'superadmin@crumi.ai', '$2b$10$3cJw/m6uCnZiSn1M/OCYM6G.65zu5KqK', 'Super', 'Admin', 99, '3000000000', 'active')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, status = 'active';
