const db = require('../config/db');
const bcrypt = require('bcrypt');

// 1. Get All Users
exports.getAllUsers = async (req, res) => {
    try {
        const { currentUserType, allowedCustomers } = req.query;
        const customersList = allowedCustomers ? allowedCustomers.split(',') : [];

        let usersQuery = "SELECT id, email, type FROM users";
        let usersParams = [];

        if (currentUserType === 'admin') {
            usersQuery = `
                SELECT DISTINCT u.id, u.email, u.type 
                FROM users u
                LEFT JOIN access a ON u.email = a.email
                WHERE a.customer IN (?) OR u.type = 'user'
            `;
            usersParams = [customersList];
        }

        const [users] = await db.query(usersQuery, usersParams);
        const [access] = await db.query("SELECT email, customer FROM access");

        const userData = users.map(u => ({
            ...u,
            customers: access.filter(a => a.email === u.email).map(a => a.customer)
        }));

        res.status(200).json(userData);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Create User
exports.createUser = async (req, res) => {
    const { email, password, type, customers, currentUserType, allowedCustomers } = req.body;
    try {
        const adminCustomers = allowedCustomers ? allowedCustomers.split(',') : [];
        if (currentUserType === 'admin') {
            if (type === 'super_admin') return res.status(403).json({ error: "Unauthorized to create Super Admin." });
            if (!customers.every(c => adminCustomers.includes(c))) return res.status(403).json({ error: "Access outside domain restricted." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query("INSERT INTO users (email, password, type) VALUES (?, ?, ?)", [email, hashedPassword, type]);

        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }
        res.status(200).json({ message: "User created!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. Update User (Password Optional Fix)
exports.updateUser = async (req, res) => {
    const { id, email, password, type, customers, currentUserType, allowedCustomers } = req.body;
    try {
        const adminCustomers = allowedCustomers ? allowedCustomers.split(',') : [];

        if (currentUserType === 'admin') {
            const [existing] = await db.query("SELECT type FROM users WHERE id = ?", [id]);
            if (existing[0]?.type === 'super_admin') return res.status(403).json({ error: "Cannot modify Super Admin." });
        }

        // 🔥 Password Update Logic: Update ONLY if password is provided
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query("UPDATE users SET type = ?, password = ? WHERE id = ?", [type, hashedPassword, id]);
        } else {
            await db.query("UPDATE users SET type = ? WHERE id = ?", [type, id]);
        }

        // Update Access
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }

        res.status(200).json({ message: "Update successful!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 4. Delete User (Self-Delete Prevention)
exports.deleteUser = async (req, res) => {
    const { id, email, currentUserType } = req.query;
    try {
        // req.user.id check tab kaam karega jab aapka Auth Middleware use ho raha ho
        // filhal hum id comparison frontend se bhi handle karenge
        
        const [existing] = await db.query("SELECT type FROM users WHERE id = ?", [id]);
        if (currentUserType === 'admin' && existing[0]?.type === 'super_admin') {
            return res.status(403).json({ error: "Unauthorized." });
        }

        await db.query("DELETE FROM users WHERE id = ?", [id]);
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        res.status(200).json({ message: "User deleted." });
    } catch (error) { res.status(500).json({ error: error.message }); }
};