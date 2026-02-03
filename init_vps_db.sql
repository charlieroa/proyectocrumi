-- Init Script for Crumi VPS

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(50),
    working_hours JSONB,
    slug VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(255),
    tax_rate NUMERIC(5,4),
    admin_fee_rate NUMERIC(5,4),
    products_for_staff_enabled BOOLEAN DEFAULT TRUE,
    admin_fee_enabled BOOLEAN DEFAULT FALSE,
    loans_to_staff_enabled BOOLEAN DEFAULT FALSE,
    tax_id_type VARCHAR(50),
    tax_id VARCHAR(50),
    business_name VARCHAR(255),
    tax_responsibility VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    sector VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'COP',
    decimal_precision INT DEFAULT 2,
    decimal_separator VARCHAR(5) DEFAULT ',',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
    role_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    payment_type VARCHAR(50),
    base_salary NUMERIC(12,2),
    commission_rate NUMERIC(5,4),
    status VARCHAR(20) DEFAULT 'active',
    last_service_at TIMESTAMP,
    last_turn_at TIMESTAMP,
    working_hours JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kanban_columns (
    id SERIAL PRIMARY KEY,
    tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    status_key VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    order_index INT DEFAULT 0,
    visible_to_role_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
