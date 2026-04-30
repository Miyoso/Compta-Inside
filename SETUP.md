# 📋 Guide de mise en place — Compta-Inside GTA RP

Suis ces étapes **dans l'ordre** pour mettre le site en ligne.

---

## ÉTAPE 1 — Préparer la base de données Neon

1. Va sur **https://console.neon.tech** et connecte-toi
2. Ouvre ton projet (ou crée-en un si besoin)
3. Clique sur **"SQL Editor"** dans le menu de gauche
4. Copie-colle **tout le contenu** du fichier `schema.sql` dans l'éditeur
5. Clique sur **"Run"** (▶)
6. Tes tables et données de base sont créées ✅

**Récupérer ta connexion string :**
- Dans Neon, va dans **"Connection Details"**
- Copie la **"Connection string"** (commence par `postgresql://...`)
- Garde-la pour l'étape 3

---

## ÉTAPE 2 — Mettre le code sur GitHub

1. Ouvre **GitHub Desktop** (ou utilise git en ligne de commande)
2. Ajoute tous les fichiers de ce dossier à ton dépôt
3. Fais un **commit** (ex: "Premier déploiement Compta-Inside")
4. Fais un **push** vers GitHub

> ⚠️ Vérifie que le fichier `.env` ou `.env.local` n'est PAS sur GitHub (il est dans `.gitignore`)

---

## ÉTAPE 3 — Configurer les variables d'environnement sur Vercel

1. Va sur **https://vercel.com** et connecte-toi
2. Ouvre ton projet lié à ce dépôt GitHub
3. Va dans **Settings → Environment Variables**
4. Ajoute ces 3 variables :

| Nom | Valeur |
|-----|--------|
| `DATABASE_URL` | Ta connexion string Neon (ex: `postgresql://user:pass@host/db?sslmode=require`) |
| `NEXTAUTH_SECRET` | Une longue chaîne aléatoire (ex: `monSuperSecretTresLong123!`) |
| `NEXTAUTH_URL` | L'URL de ton site Vercel (ex: `https://compta-inside.vercel.app`) |

5. Clique **Save** pour chaque variable

---

## ÉTAPE 4 — Déployer

1. Sur Vercel, clique **"Redeploy"** (ou pousse un nouveau commit sur GitHub)
2. Attends 1-2 minutes que le build se termine
3. Clique sur **"Visit"** pour voir ton site en ligne 🎉

---

## FAQ

**Q : Comment ajouter une nouvelle entreprise ?**
Exécute cette requête dans l'éditeur SQL de Neon :
```sql
INSERT INTO companies (name) VALUES ('Nom de la nouvelle entreprise');
```
Elle apparaîtra automatiquement dans le formulaire d'inscription.

**Q : Comment voir les utilisateurs inscrits ?**
```sql
SELECT u.name, u.email, u.role, c.name AS entreprise, u.created_at
FROM users u
LEFT JOIN companies c ON c.id = u.company_id
ORDER BY u.created_at DESC;
```

**Q : Comment promouvoir quelqu'un en admin ?**
```sql
UPDATE users SET role = 'admin' WHERE email = 'email@exemple.com';
```

---

*Compta-Inside · GTA RP*
