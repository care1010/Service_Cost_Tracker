const db = require('../config/db');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    console.log("Login Attempt for:", email); // Terminal mein dikhega

    try {
        // 1. Check user in 'users' table
        const [userRows] = await db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password]);

        if (userRows.length === 0) {
            console.log("❌ User not found or password mismatch");
            return res.status(401).json({ error: "Invalid Email or Password" });
        }

        const user = userRows[0];
        console.log("✅ User found:", user.email);

        // 2. Get allowed customers from 'access' table
        const [accessRows] = await db.query("SELECT customer FROM access WHERE email = ?", [email]);
        const allowedCustomers = accessRows.map(row => row.customer);
        console.log("📋 Allowed Customers:", allowedCustomers);

        res.status(200).json({
            message: "Login Successful",
            user: {
                email: user.email,
                type: user.type,
                allowedCustomers: allowedCustomers
            }
        });

    } catch (error) {
        console.error("🔥 Auth Error:", error);
        res.status(500).json({ error: "Database connection error" });
    }
};