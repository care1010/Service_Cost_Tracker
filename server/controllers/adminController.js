const db = require('../config/db');

// 1. Saare users aur unke mapped customers laana (With RLS)
exports.getAllUsers = async (req, res) => {
    try {
        const { currentUserType, allowedCustomers } = req.query;
        const customersList = allowedCustomers ? allowedCustomers.split(',') : [];

        let usersQuery = "SELECT id, email, password, type FROM users";
        let usersParams = [];

        // RLS for Admin
        if (currentUserType === 'admin') {
            // Admins can only see users mapping to overlapping customers or basic 'user' type accounts
            usersQuery = `
                SELECT DISTINCT u.id, u.email, u.password, u.type 
                FROM users u
                LEFT JOIN access a ON u.email = a.email
                WHERE a.customer IN (?) OR u.type = 'user'
            `;
            usersParams = [customersList];
        }

        const [users] = await db.query(usersQuery, usersParams);
        const [access] = await db.query("SELECT email, customer FROM access");

        // Users ke saath unke customers ko group karna
        const userData = users.map(u => ({
            ...u,
            customers: access.filter(a => a.email === u.email).map(a => a.customer)
        }));

        res.status(200).json(userData);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// 2. Naya User Create karna (With Security Checks)
exports.createUser = async (req, res) => {
    const { email, password, type, customers, currentUserType, allowedCustomers } = req.body;
    try {
        const adminCustomers = allowedCustomers ? allowedCustomers.split(',') : [];

        // Role restriction checks for Admin
        if (currentUserType === 'admin') {
            if (type === 'super_admin') {
                return res.status(403).json({ error: "Admins are unauthorized to create Super Admins." });
            }
            // Enforce customer access boundaries
            const isValidAccess = customers.every(c => adminCustomers.includes(c));
            if (!isValidAccess) {
                return res.status(403).json({ error: "You cannot assign customers outside your access domain." });
            }
        }

        // A. Users table mein insert
        await db.query("INSERT INTO users (email, password, type) VALUES (?, ?, ?)", [email, password, type]);

        // B. Access table mein mapping (Multiple rows)
        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }

        res.status(200).json({ message: "User created successfully!" });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// 3. User Update karna (With Security Checks)
exports.updateUser = async (req, res) => {
    const { id, email, password, type, customers, currentUserType, allowedCustomers } = req.body;
    try {
        const adminCustomers = allowedCustomers ? allowedCustomers.split(',') : [];

        // Role restriction checks for Admin
        if (currentUserType === 'admin') {
            if (type === 'super_admin') {
                return res.status(403).json({ error: "Admins cannot elevate users to Super Admin." });
            }

            // Verify they aren't trying to modify an existing Super Admin
            const [existing] = await db.query("SELECT type FROM users WHERE id = ?", [id]);
            if (existing.length > 0 && existing[0].type === 'super_admin') {
                return res.status(403).json({ error: "Modification of Super Admin accounts is restricted." });
            }

            // Enforce customer boundaries
            const isValidAccess = customers.every(c => adminCustomers.includes(c));
            if (!isValidAccess) {
                return res.status(403).json({ error: "You cannot assign unauthorized customers to users." });
            }
        }

        // A. User details update
        await db.query("UPDATE users SET type = ?, password = ? WHERE id = ?", [type, password, id]);

        // B. Purani mapping delete karke nayi insert karna
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }

        res.status(200).json({ message: "User updated successfully!" });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// 4. User Delete karna (With Security Checks)
exports.deleteUser = async (req, res) => {
    const { id, email, currentUserType } = req.query;
    try {
        if (currentUserType === 'admin') {
            const [existing] = await db.query("SELECT type FROM users WHERE id = ?", [id]);
            if (existing.length > 0 && existing[0].type === 'super_admin') {
                return res.status(403).json({ error: "Admins are unauthorized to delete Super Admins." });
            }
        }

        await db.query("DELETE FROM users WHERE id = ?", [id]);
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        res.status(200).json({ message: "User deleted!" });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};