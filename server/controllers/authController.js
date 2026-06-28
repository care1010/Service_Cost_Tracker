const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    console.log("Login Attempt for:", email);

    try {

        // User find by email only
        const [userRows] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (userRows.length === 0) {
            console.log("❌ User not found");
            return res.status(401).json({
                error: "Invalid Email or Password"
            });
        }

        const user = userRows[0];

        // Compare entered password with hashed password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            console.log("❌ Password mismatch");
            return res.status(401).json({
                error: "Invalid Email or Password"
            });
        }

        console.log("✅ User authenticated:", user.email);

        // Get allowed customers
        const [accessRows] = await db.query(
            "SELECT customer FROM access WHERE email = ?",
            [email]
        );

        const allowedCustomers = accessRows.map(
            row => row.customer
        );

        res.status(200).json({
            message: "Login Successful",
            user: {
                email: user.email,
                type: user.type,
                allowedCustomers
            }
        });

    } catch (error) {
        console.error("🔥 Auth Error:", error);

        res.status(500).json({
            error: "Database connection error"
        });
    }
};