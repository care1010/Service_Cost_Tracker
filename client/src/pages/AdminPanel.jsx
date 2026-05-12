import React, { useState } from 'react';
import axios from 'axios';

//var for details to create user
const AddUser = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [type, setType] = useState('user');
    const [allowedCustomers, setAllowedCustomers] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await axios.post('/api/users', {
                email,
                password,
                type,
                allowedCustomers
            });
            console.log(response.data);
            // Reset form
            setEmail('');
            setPassword('');
            setType('user');
            setAllowedCustomers('');
        } catch (error) {
            console.error('Error adding user:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Add User</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Type:</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div>
                    <label>Allowed Customers:</label>
                    <input
                        type="text"
                        value={allowedCustomers}
                        onChange={(e) => setAllowedCustomers(e.target.value)}
                    />
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Adding...' : 'Add User'}
                </button>
            </form>
        </div>
    );
};