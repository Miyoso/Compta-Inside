import { getToken } from 'next-auth/jwt';
import sql from '../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });

  const companyId = token.companyId;
  const isPatron  = ['patron', 'admin'].includes(token.role);
  const userId    = parseInt(token.sub);

  // ── GET : liste des factures ──────────────────────────────
  if (req.method === 'GET') {
    const { scope } = req.query;

    // ── 1. Factures classiques (nouveau système) ──────────────
    const invoices = isPatron
      ? await sql`
          SELECT i.id, i.created_at, i.total_amount::float, u.name AS employee_name,
                 'invoice' AS source
          FROM invoices i
          JOIN users u ON u.id = i.employee_id
          WHERE i.company_id = ${companyId}
          ${scope === 'week' ? sql`AND i.created_at >= DATE_TRUNC('week', NOW())` : sql``}
          ORDER BY i.created_at DESC LIMIT 100
        `
      : await sql`
          SELECT i.id, i.created_at, i.total_amount::float,
                 'invoice' AS source
          FROM invoices i
          WHERE i.company_id = ${companyId} AND i.employee_id = ${userId}
          ${scope === 'week' ? sql`AND i.created_at >= DATE_TRUNC('week', NOW())` : sql``}
          ORDER BY i.created_at DESC LIMIT 100
        `;

    const invoiceResults = await Promise.all(
      invoices.map(async (inv) => {
        const items = await sql`
          SELECT p.name AS product_name, s.quantity, s.unit_price::float, s.total_amount::float
          FROM sales s
          JOIN products p ON p.id = s.product_id
          WHERE s.invoice_id = ${inv.id}
          ORDER BY p.name ASC
        `;
        return { ...inv, items };
      })
    );

    // ── 2. Ventes directes sans facture (ancien système) ──────
    const bareSales = isPatron
      ? await sql`
          SELECT s.id, s.sale_date AS created_at, s.total_amount::float,
                 u.name AS employee_name, p.name AS product_name,
                 s.quantity, s.unit_price::float,
                 'sale' AS source
          FROM sales s
          JOIN users u ON u.id = s.employee_id
          JOIN products p ON p.id = s.product_id
          WHERE s.company_id = ${companyId}
            AND s.invoice_id IS NULL
          ${scope === 'week' ? sql`AND s.sale_date >= DATE_TRUNC('week', NOW())` : sql``}
          ORDER BY s.sale_date DESC LIMIT 100
        `
      : await sql`
          SELECT s.id, s.sale_date AS created_at, s.total_amount::float,
                 p.name AS product_name, s.quantity, s.unit_price::float,
                 'sale' AS source
          FROM sales s
          JOIN products p ON p.id = s.product_id
          WHERE s.company_id = ${companyId}
            AND s.employee_id = ${userId}
            AND s.invoice_id IS NULL
          ${scope === 'week' ? sql`AND s.sale_date >= DATE_TRUNC('week', NOW())` : sql``}
          ORDER BY s.sale_date DESC LIMIT 100
        `;

    // Regrouper les ventes directes en pseudo-factures par vente unique
    const bareResults = bareSales.map(s => ({
      id:            `sale-${s.id}`,
      created_at:    s.created_at,
      total_amount:  s.total_amount,
      employee_name: s.employee_name,
      source:        'sale',
      items: [{
        product_name: s.product_name,
        quantity:     s.quantity,
        unit_price:   s.unit_price,
        total_amount: s.total_amount,
      }],
    }));

    // ── 3. Fusionner et trier par date décroissante ────────────
    const combined = [...invoiceResults, ...bareResults]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 150);

    return res.status(200).json(combined);
  }

  // ── POST : créer une facture ──────────────────────────────
  if (req.method === 'POST') {
    const { employee_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide.' });
    }

    const empId = isPatron && employee_id ? parseInt(employee_id) : userId;
    let totalAmount = 0;
    const processed = [];

    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: 'Données produit invalides.' });
      }
      const [product] = await sql`
        SELECT id, price::float, name FROM products
        WHERE id = ${item.product_id} AND company_id = ${companyId}
      `;
      if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;
      processed.push({ ...item, unit_price: product.price, subtotal, product_name: product.name });
    }

    // Créer la facture
    const [invoice] = await sql`
      INSERT INTO invoices (company_id, employee_id, total_amount)
      VALUES (${companyId}, ${empId}, ${totalAmount})
      RETURNING id
    `;

    // Insérer les lignes de vente + déduire matières premières selon recette
    for (const item of processed) {
      await sql`
        INSERT INTO sales (company_id, employee_id, product_id, quantity, unit_price, total_amount, invoice_id)
        VALUES (${companyId}, ${empId}, ${item.product_id}, ${item.quantity}, ${item.unit_price}, ${item.subtotal}, ${invoice.id})
      `;

      // Déduire les matières premières et logger le mouvement
      const recipe = await sql`
        SELECT raw_material_id, quantity_per_unit::float
        FROM product_recipes
        WHERE product_id = ${item.product_id} AND company_id = ${companyId}
      `;

      for (const ingredient of recipe) {
        const deduct = ingredient.quantity_per_unit * item.quantity;

        // Mise à jour stock avec RETURNING pour avoir le stock après
        const [updated] = await sql`
          UPDATE raw_materials
          SET quantity = GREATEST(0, quantity - ${deduct})
          WHERE id = ${ingredient.raw_material_id} AND company_id = ${companyId}
          RETURNING quantity::float AS new_qty, name
        `;

        if (updated) {
          await sql`
            INSERT INTO stock_movements
              (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_id, reference_label)
            VALUES
              (${companyId}, ${ingredient.raw_material_id}, 'sale', ${-deduct},
               ${updated.new_qty}, ${invoice.id},
               ${`Facture #${invoice.id} — ${item.product_name} ×${item.quantity}`})
          `;
        }
      }
    }

    return res.status(201).json({ invoice_id: invoice.id, total_amount: totalAmount, items: processed });
  }

  // ── DELETE : annuler une facture ──────────────────────────
  if (req.method === 'DELETE') {
    if (!isPatron) return res.status(403).json({ error: 'Accès refusé.' });
    const { id } = req.body;

    const salesLines = await sql`
      SELECT product_id, quantity FROM sales
      WHERE invoice_id = ${id} AND company_id = ${companyId}
    `;

    for (const sale of salesLines) {
      const recipe = await sql`
        SELECT raw_material_id, quantity_per_unit::float
        FROM product_recipes
        WHERE product_id = ${sale.product_id} AND company_id = ${companyId}
      `;
      for (const ingredient of recipe) {
        const restore = ingredient.quantity_per_unit * sale.quantity;

        const [updated] = await sql`
          UPDATE raw_materials SET quantity = quantity + ${restore}
          WHERE id = ${ingredient.raw_material_id} AND company_id = ${companyId}
          RETURNING quantity::float AS new_qty
        `;

        if (updated) {
          await sql`
            INSERT INTO stock_movements
              (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_id, reference_label)
            VALUES
              (${companyId}, ${ingredient.raw_material_id}, 'sale_cancel', ${restore},
               ${updated.new_qty}, ${id}, ${`Annulation facture #${id}`})
          `;
        }
      }
    }

    await sql`DELETE FROM invoices WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
