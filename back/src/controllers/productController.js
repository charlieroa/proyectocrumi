// =========================================================
// File: src/controllers/productController.js
// =========================================================
const db = require('../config/db');
const { insertMovementRaw, recordMovementInline } = require('./kardexController');

// --- Helper: valida/normaliza porcentaje (0–100) o null ---
function parsePercentOrNull(input, fieldName = 'product_commission_percent') {
  if (input === undefined || input === null || input === '') return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    const err = new Error(`${fieldName} debe estar entre 0 y 100.`);
    err.status = 400;
    throw err;
  }
  return Math.round(n * 100) / 100;
}

const numOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const boolOrNull = (v) => (v === undefined || v === null ? null : (v === true || v === 'true' || v === 1 || v === '1'));

/**
 * Crea un nuevo producto. Acepta el payload completo del FE.
 * Si el producto es inventariable y se pasa stock>0 + cost>0, genera un movimiento
 * de kardex IN de apertura para que el saldo costeado quede coherente desde el día 1.
 */
exports.createProduct = async (req, res) => {
  const b = req.body || {};
  const { tenant_id, id: user_id } = req.user;

  // Aliases: el FE manda price/cost; los campos legacy sale_price/cost_price siguen
  // soportándose para no romper consumidores existentes.
  const finalSalePrice = numOrNull(b.price ?? b.sale_price);
  const finalCost = numOrNull(b.cost ?? b.cost_price) ?? 0;
  const stockNum = numOrNull(b.stock) ?? 0;
  const isInventoriable = boolOrNull(b.is_inventoriable) ?? true;

  if (!b.name || finalSalePrice === null || isNaN(finalSalePrice)) {
    return res.status(400).json({ error: 'Campos obligatorios: name, price (o sale_price).' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO products (
         tenant_id, name, description, sku, barcode,
         price, cost, tax_rate, retention_rate, stock,
         category_id, unit, dian_uom_code,
         is_inventoriable, visible_in_invoices, include_iva_in_price,
         image_url, is_active
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15, $16,
         $17, true
       )
       RETURNING *, price AS sale_price, cost AS cost_price`,
      [
        tenant_id, b.name, b.description || null, b.sku || null, b.barcode || null,
        finalSalePrice, finalCost, numOrNull(b.tax_rate) ?? 0, numOrNull(b.retention_rate),
        stockNum,
        b.category_id || null, b.unit || 'und', b.dian_uom_code || null,
        isInventoriable,
        boolOrNull(b.visible_in_invoices) !== false,
        boolOrNull(b.include_iva_in_price) === true,
        b.image_url || null,
      ]
    );
    const created = result.rows[0];

    // Stock inicial → movimiento de apertura. Sin asiento contable (es saldo previo
    // a la implementación del sistema; el contable los carga vía un asiento global
    // de apertura aparte).
    if (isInventoriable && stockNum > 0 && finalCost > 0) {
      await insertMovementRaw(client, tenant_id, {
        productId: created.id,
        type: 'IN',
        quantity: stockNum,
        unitCost: finalCost,
        documentType: 'APERTURA',
        documentNumber: 'APERTURA',
        notes: 'Saldo inicial al crear producto',
        userId: user_id,
      });
    }

    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear el producto:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  } finally {
    client.release();
  }
};

/**
 * Obtiene todos los productos activos de un tenant, con filtros opcionales.
 */
exports.getProductsByTenant = async (req, res) => {
  const { tenant_id } = req.user;

  try {
    const query = `
      SELECT p.*,
             p.price AS sale_price,
             p.cost AS cost_price,
             c.name as category_name
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.tenant_id = $1 AND COALESCE(p.is_active, TRUE) = TRUE
      ORDER BY p.name`;
    const result = await db.query(query, [tenant_id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

/**
 * Obtiene un producto específico por su ID.
 */
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;
  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.is_active = TRUE`,
      [id, tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Actualiza un producto. Acepta el payload completo del FE.
 * NOTA: el `stock` no se modifica directamente desde aquí; debe pasar por el kardex
 * (POST /api/kardex/movement con type=ADJUST). Si se pasa, se ignora con un aviso.
 */
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;
  const b = req.body || {};

  try {
    const currentRes = await db.query('SELECT * FROM products WHERE id = $1 AND tenant_id = $2', [id, tenant_id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    const current = currentRes.rows[0];

    let pct;
    try {
      if (b.product_commission_percent !== undefined) {
        pct = parsePercentOrNull(b.product_commission_percent);
      }
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const newPrice = numOrNull(b.price ?? b.sale_price) ?? Number(current.price);
    const newCost = numOrNull(b.cost ?? b.cost_price) ?? Number(current.cost);

    const result = await db.query(
      `UPDATE products SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          sku = COALESCE($3, sku),
          barcode = COALESCE($4, barcode),
          price = $5,
          cost = $6,
          tax_rate = COALESCE($7, tax_rate),
          retention_rate = COALESCE($8, retention_rate),
          category_id = COALESCE($9, category_id),
          unit = COALESCE($10, unit),
          dian_uom_code = COALESCE($11, dian_uom_code),
          is_inventoriable = COALESCE($12, is_inventoriable),
          visible_in_invoices = COALESCE($13, visible_in_invoices),
          include_iva_in_price = COALESCE($14, include_iva_in_price),
          image_url = COALESCE($15, image_url),
          staff_price = COALESCE($16, staff_price),
          audience_type = COALESCE($17, audience_type),
          product_commission_percent = COALESCE($18, product_commission_percent),
          updated_at = NOW()
       WHERE id = $19 AND tenant_id = $20
       RETURNING *, price AS sale_price, cost AS cost_price`,
      [
        b.name ?? null,
        b.description ?? null,
        b.sku ?? null,
        b.barcode ?? null,
        newPrice,
        newCost,
        numOrNull(b.tax_rate),
        numOrNull(b.retention_rate),
        b.category_id ?? null,
        b.unit ?? null,
        b.dian_uom_code ?? null,
        boolOrNull(b.is_inventoriable),
        boolOrNull(b.visible_in_invoices),
        boolOrNull(b.include_iva_in_price),
        b.image_url ?? null,
        numOrNull(b.staff_price),
        b.audience_type ?? null,
        pct ?? null,
        id, tenant_id
      ]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar el producto:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

/**
 * Elimina un producto (Borrado Lógico).
 */
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.user;
  try {
    const result = await db.query(
      'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenant_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Ajuste manual de stock — delega en el kardex (recordMovementInline) para que
 * cualquier movimiento quede costeado y con asiento contable. Usar
 * POST /api/kardex/movement directamente cuando se pueda; este endpoint queda
 * como atajo retro-compatible.
 */
exports.manageStock = async (req, res) => {
  const { productId } = req.params;
  const { type, quantity, description, unitCost } = req.body;
  const { tenant_id, id: user_id } = req.user;

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty === 0) return res.status(400).json({ error: 'La cantidad debe ser un número distinto de 0.' });

  // Mapear tipos legacy → tipos canónicos del kardex
  const typeMap = {
    purchase: 'IN',
    'adjustment-in': 'ADJUST',
    sale: 'OUT',
    'adjustment-out': 'OUT',
    damaged: 'OUT',
    IN: 'IN', OUT: 'OUT', ADJUST: 'ADJUST',
  };
  const canonical = typeMap[type];
  if (!canonical) return res.status(400).json({ error: 'Tipo no válido (purchase|sale|adjustment-in|adjustment-out|damaged|IN|OUT|ADJUST)' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { movement, journal } = await recordMovementInline(client, tenant_id, {
      productId: Number(productId),
      type: canonical,
      quantity: Math.abs(qty),
      unitCost: Number(unitCost) || 0,
      documentType: 'AJUSTE_MANUAL',
      documentNumber: `ADJ-${Date.now()}`,
      notes: description || null,
      userId: user_id,
    });
    await client.query('COMMIT');
    res.status(200).json({ message: 'Stock actualizado vía kardex', movement, journal });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al gestionar el stock:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message });
  } finally {
    client.release();
  }
};

/**
 * Actualiza la URL de la imagen de un producto después de que Multer la haya subido.
 */
exports.uploadProductImage = async (req, res) => {
  const { productId } = req.params;
  const { tenant_id } = req.user;

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo de imagen.' });
  }

  const imageUrl = `/uploads/products/${req.file.filename}`;

  try {
    const result = await db.query(
      'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [imageUrl, productId, tenant_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Producto no encontrado o no pertenece a tu negocio.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar la URL de la imagen del producto:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
