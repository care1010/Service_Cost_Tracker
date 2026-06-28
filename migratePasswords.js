const bcrypt = require('bcrypt');
const db = require('./server/config/db');

async function migratePasswords() {
    try {
        const [users] = await db.query(
            "SELECT id, password FROM users"
        );

        for (const user of users) {

            // Skip already hashed passwords
            if (
                user.password.startsWith('$2a$') ||
                user.password.startsWith('$2b$') ||
                user.password.startsWith('$2y$')
            ) {
                continue;
            }

            const hashedPassword = await bcrypt.hash(
                user.password,
                10
            );

            await db.query(
                "UPDATE users SET password = ? WHERE id = ?",
                [hashedPassword, user.id]
            );

            console.log(`Updated User ID ${user.id}`);
        }

        console.log('Migration Complete');
        process.exit();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migratePasswords();