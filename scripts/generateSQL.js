
import bcrypt from 'bcrypt';

const generateSQL = async () => {
    const email = 'rhectoroc@gmail.com';
    const plainPassword = '04uoC4Miq5a3';
    const role = 'ADMIN';

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    console.log(`-- SQL Query to execute in DbGate:`);
    console.log(`INSERT INTO users (email, password_hash, role) VALUES ('${email}', '${hashedPassword}', '${role}');`);
};

generateSQL();
