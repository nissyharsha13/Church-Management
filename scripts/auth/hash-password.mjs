#!/usr/bin/env node
// Generates the admin login environment variables.
// Usage: npm run auth:hash -- '<password>'        (or no argument to generate a strong password)
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2] || randomBytes(12).toString("base64url");
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p });

console.log("# Add these to .env.local (local) or the Vercel project settings (Environment Variables):");
console.log("ADMIN_USERNAME=admin");
// Dot-separated on purpose: .env files expand "$NAME", which would corrupt a "$"-separated hash.
console.log("ADMIN_PASSWORD_HASH=" + ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("."));
console.log(`AUTH_SECRET=${randomBytes(32).toString("base64url")}   # only needed once; changing it signs everyone out`);
if (!process.argv[2]) console.log(`\n# Generated password (store it safely, it is not saved anywhere): ${password}`);
