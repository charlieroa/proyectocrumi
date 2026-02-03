UPDATE users 
SET password_hash = '$2b$10$3cJw/m6uCnZiSn1M/OCYM6G.65zu5KqK', 
    status = 'active' 
WHERE email IN ('superadmin@crumi.ai', 'prueba@prueba.com', 'salon@salon.com');
