const express = require("express");
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(express.json());

/* ================== Database Connections ================== */
let pool;
const connectDBs = async () => {
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });
        await pool.query('CREATE TABLE IF NOT EXISTS budgets (id INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(255), `limit` DECIMAL(10, 2))');
        console.log("MySQL Connected");

        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");

        // Sync: MySQL -> MongoDB
        const [rows] = await pool.query("SELECT * FROM budgets");
        for (const row of rows) {
            const exists = await Budget.findOne({ mysql_id: row.id });
            if (!exists) {
                await new Budget({ mysql_id: row.id, category: row.category, limit: row.limit }).save();
            }
        }
    } catch (e) { console.error("Connection Error", e); }
};

/* ================== Schema ================== */
const BudgetSchema = new mongoose.Schema({ mysql_id: Number, category: String, limit: Number });
const Budget = mongoose.model("Budget", BudgetSchema);

connectDBs();

/* ================== Routes ================== */

app.get("/budgets", async (req, res) => {
    try {
        const data = await Budget.find();
        // Map mysql_id to id for frontend compatibility
        const mapped = data.map(d => ({ id: d.mysql_id, _id: d._id, category: d.category, limit: d.limit }));
        res.json(mapped);
    } catch (err) { res.status(500).send(err.message); }
});

app.post("/budgets", async (req, res) => {
    try {
        const { category, limit } = req.body;
        
        // 1. MySQL
        const [result] = await pool.execute("INSERT INTO budgets (category, `limit`) VALUES (?, ?)", [category, limit]);
        const newId = result.insertId;

        // 2. MongoDB
        await new Budget({ mysql_id: newId, category, limit }).save();

        res.send("Budget saved dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.delete("/budgets/:id", async (req, res) => {
    try {
        const id = req.params.id;
        // 1. MySQL
        if (!isNaN(id)) {
            await pool.execute("DELETE FROM budgets WHERE id = ?", [id]);
        }
        // 2. MongoDB
        const filter = isNaN(id) ? { _id: id } : { mysql_id: parseInt(id) };
        await Budget.deleteOne(filter);

        res.send("Budget deleted dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log("Budget service running"));
