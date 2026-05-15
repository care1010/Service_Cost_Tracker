const db = require('../config/db');

// 1. Saare users aur unke mapped customers laana
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, email, password, type FROM users");
        const [access] = await db.query("SELECT email, customer FROM access");

        // Users ke saath unke customers ko group karna
        const userData = users.map(u => ({
            ...u,
            customers: access.filter(a => a.email === u.email).map(a => a.customer)
        }));

        res.status(200).json(userData);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Naya User Create karna
exports.createUser = async (req, res) => {
    const { email, password, type, customers } = req.body;
    try {
        // A. Users table mein insert
        await db.query("INSERT INTO users (email, password, type) VALUES (?, ?, ?)", [email, password, type]);

        // B. Access table mein mapping (Multiple rows)
        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }

        res.status(200).json({ message: "User created successfully!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. User Update karna
exports.updateUser = async (req, res) => {
    const { id, email, password, type, customers } = req.body;
    try {
        // A. User details update
        await db.query("UPDATE users SET type = ?, password = ? WHERE id = ?", [type, password, id]);

        // B. Purani mapping delete karke nayi insert karna (Sync logic)
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        if (customers && customers.length > 0) {
            const mappingRows = customers.map(c => [c, email]);
            await db.query("INSERT INTO access (customer, email) VALUES ?", [mappingRows]);
        }

        res.status(200).json({ message: "User updated successfully!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 4. User Delete karna
exports.deleteUser = async (req, res) => {
    const { id, email } = req.query;
    try {
        await db.query("DELETE FROM users WHERE id = ?", [id]);
        await db.query("DELETE FROM access WHERE email = ?", [email]);
        res.status(200).json({ message: "User deleted!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};