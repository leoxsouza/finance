import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { getAuthCredentials } from "@/lib/auth/config";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Email and password are required");
        }

        const { email: allowedEmail, passwordHash: allowedPasswordHash } = getAuthCredentials();

        const incomingEmail = credentials.email.trim().toLowerCase();
        const passwordsMatch = await bcrypt.compare(credentials.password, allowedPasswordHash);

        if (incomingEmail !== allowedEmail || !passwordsMatch) {
          throw new Error("Invalid credentials");
        }

        return {
          id: "owner",
          name: "Owner",
          email: allowedEmail,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};

export default authOptions;
