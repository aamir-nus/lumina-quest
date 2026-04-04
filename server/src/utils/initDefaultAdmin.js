import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AUTH } from '../constants/appConstants.js';

/**
 * Ensure default admin user exists.
 * Call this during server startup to guarantee admin access.
 *
 * Default credentials:
 * - Email/Username: admin@luminaquest.local (or just "admin" for login)
 * - Password: admin
 */
export async function ensureDefaultAdmin() {
  try {
    const adminEmail = 'admin@luminaquest.local';
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log('[INIT] Default admin user already exists');
      return;
    }

    const passwordHash = await bcrypt.hash('admin', AUTH.BCRYPT_SALT_ROUNDS);
    await User.create({
      email: adminEmail,
      passwordHash,
      role: 'admin'
    });

    console.log('[INIT] ✅ Created default admin user (email: admin@luminaquest.local, password: admin)');
    console.log('[INIT] 💡 Tip: You can also login with just "admin" as the username');
  } catch (error) {
    console.error('[INIT] ⚠️  Failed to create default admin:', error.message);
  }
}
