// Connexion à la base de données Neon (PostgreSQL)
import { neon } from '@neondatabase/serverless';

// On crée une fonction SQL réutilisable partout dans l'app
const sql = neon(process.env.DATABASE_URL);

export default sql;
