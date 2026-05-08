const express = require('express');
const cors = require('cors'); // 1. Yeh line honi chahiye
const dataRoutes = require('./routes/dataRoutes');
require('dotenv').config();

const app = express();

app.use(cors()); // 2. Yeh line honi chahiye (Sabse upar)
app.use(express.json());

app.use('/api/data', dataRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));