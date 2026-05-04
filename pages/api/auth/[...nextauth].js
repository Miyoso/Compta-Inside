import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import sql from '../../../lib/db';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Identifiant et mot de passe',
      credentials: {
        username: { label: 'Identifiant', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // Recherche par username (insensible à la casse)
        const rows = await sql`
          SELECT u.id, u.username, u.email, u.name, u.password_hash, u.role, u.status,
                 u.company_id, c.name AS company_name, COALESCE(c.company_type, 'cafe') AS company_type
          FROM users u
          LEFT JOIN companies c ON c.id = u.company_id
          WHERE LOWER(u.username) = LOWER(${credentials.username})
          LIMIT 1
        `;

        const user = rows[0];
        if (!user) return null;

        // Vérification du mot de passe
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        // Vérification du statut du compte
        if (user.status === 'inactive') {
          throw new Error('AccountInactive');
        }
        if (user.status === 'pending') {
          throw new Error('AccountPending');
        }
        if (user.status === 'rejected') {
          throw new Error('AccountRejected');
        }

        return {
          id:          String(user.id),
          username:    user.username,
          email:       user.email,
          name:        user.name,
          role:        user.role,
          companyId:   user.company_id,
          companyName: user.company_name,
          companyType: user.company_type || 'cafe',
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id;
        token.username    = user.username;
        token.role        = user.role;
        token.companyId   = user.companyId;
        token.companyName = user.companyName;
        token.companyType = user.companyType;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id          = token.id;
        session.user.username    = token.username;
        session.user.role        = token.role;
        session.user.companyId   = token.companyId;
        session.user.companyName = token.companyName;
        session.user.companyType = token.companyType;
      }
      return session;
    },
  },

  pages: {
    signIn: '/',
    error:  '/',
  },

  secret: process.env.NEXTAUTH_SECRET,
});
