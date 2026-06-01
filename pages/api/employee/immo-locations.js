import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['employee', 'patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const employeeId = token.id;
  const companyId  = token.companyId;

  // GET — locations de cet employé
  if (req.method === 'GET') {
    const locations = await sql`
      SELECT l.id, l.bien_id, l.bien_nom, l.adresse,
             l.client_prenom, l.client_nom, l.client_numero,
             l.tier_stock, l.nb_jours,
             l.prix_jour::float, l.prix_total::float,
             l.taxe_pct::float, l.marge_pct::float,
             l.benefice_agence::float, l.taxe_reversee::float,
             l.notes, l.created_at
      FROM immo_locations l
      WHERE l.employee_id = ${employeeId}
        AND l.company_id  = ${companyId}
      ORDER BY l.created_at DESC
    `;
    return res.status(200).json(locations);
  }

  // POST — enregistrer une location
  if (req.method === 'POST') {
    const {
      bien_id, bien_nom, adresse, client_prenom, client_nom, client_numero,
      tier_stock, nb_jours, prix_jour, taxe_pct, marge_pct, notes
    } = req.body;

    if (!bien_id || !bien_nom || !client_prenom || !client_nom || !tier_stock || !nb_jours || !prix_jour) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    const prix_total      = parseFloat(prix_jour) * parseInt(nb_jours);
    const taxe_montant    = prix_total * (parseFloat(taxe_pct) / 100);
    const marge_montant   = prix_total * (parseFloat(marge_pct) / 100);
    const benefice_agence = parseFloat(marge_montant.toFixed(2));
    const taxe_reversee   = parseFloat(taxe_montant.toFixed(2));

    const [loc] = await sql`
      INSERT INTO immo_locations
        (company_id, employee_id, bien_id, bien_nom, adresse, client_prenom, client_nom, client_numero,
         tier_stock, nb_jours, prix_jour, prix_total,
         taxe_pct, marge_pct, benefice_agence, taxe_reversee, notes)
      VALUES
        (${companyId}, ${employeeId}, ${bien_id}, ${bien_nom}, ${adresse || ''},
         ${client_prenom}, ${client_nom}, ${client_numero || ''},
         ${tier_stock}, ${nb_jours}, ${prix_jour}, ${prix_total},
         ${taxe_pct}, ${marge_pct}, ${benefice_agence}, ${taxe_reversee}, ${notes || ''})
      RETURNING id
    `;
    return res.status(201).json({ success: true, id: loc.id, prix_total, benefice_agence, taxe_reversee });
  }

  return res.status(405).end();
}
