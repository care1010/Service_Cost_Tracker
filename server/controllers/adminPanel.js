const db = require('../config/db');

exports.getAdminPanel = async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, email, type, allowedCustomers FROM users");
        res.json({ users });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

exports.addUser = async (req, res) => {
    const { email, password, type, allowedCustomers } = req.body;
    if (!email || !password || !type) {
        return res.status(400).json({ error: "Email, password, and type are required" });
    }
};