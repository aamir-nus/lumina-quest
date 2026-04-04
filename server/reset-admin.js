/**
 * Reset admin user script
 * Deletes existing admin users and creates a fresh one with correct credentials
 */

import { env, validateEnv } from './src/config/env.js';
import { connectMongoWithRetry } from './src/config/db.js';
import bcrypt from 'bcryptjs';
import { User } from './src/models/User.js';
import { AUTH } from './src/constants/appConstants.js';

async function resetAdmin() {
  validateEnv();
  await connectMongoWithRetry();

  const adminEmail = 'admin@luminaquest.local';
  const password = 'admin';

  // Delete any existing admin users
  const deleted = await User.deleteMany({ role: 'admin' });
  console.log(`Deleted ${deleted.deletedCount} existing admin user(s)`);

  // Create new admin user
  const passwordHash = await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
  const admin = await User.create({
    email: adminEmail,
    passwordHash,
    role: 'admin'
  });

  console.log('\n✅ Admin user reset successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email:    ${adminEmail}`);
  console.log(`Username: admin`);
  console.log(`Password: ${password}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Tip: You can login with either "admin@luminaquest.local" or just "admin"');
}

resetAdmin().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
