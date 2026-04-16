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
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");

        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });
        await pool.query('CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, mongo_id VARCHAR(50), name VARCHAR(255), type VARCHAR(50))');
        console.log("MySQL Connected");

        // Sync
        const items = await Category.find();
        for (const item of items) {
            const [rows] = await pool.query("SELECT * FROM categories WHERE mongo_id = ?", [item._id.toString()]);
            if (rows.length === 0) {
                await pool.execute("INSERT INTO categories (mongo_id, name, type) VALUES (?, ?, ?)", [item._id.toString(), item.name, item.type]);
            }
        }
    } catch (e) { console.error("Connection Error", e); }
};

/* ================== Schema ================== */
const CategorySchema = new mongoose.Schema({ name: String, type: String });
const Category = mongoose.model("Category", CategorySchema);

connectDBs();

/* ================== Routes ================== */

app.get("/categories", async (req, res) => {
    try {
        const data = await Category.find();
        res.json(data);
    } catch (err) { res.status(500).send(err.message); }
});

app.post("/categories", async (req, res) => {
    try {
        const { name, type } = req.body;
        const newCat = new Category({ name, type });
        const saved = await newCat.save();

        await pool.execute("INSERT INTO categories (mongo_id, name, type) VALUES (?, ?, ?)", [saved._id.toString(), name, type]);
        res.send("Category saved dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.delete("/categories/:id", async (req, res) => {
    try {
        const id = req.params.id;
        await Category.findByIdAndDelete(id);
        await pool.execute("DELETE FROM categories WHERE mongo_id = ?", [id]);
        res.send("Category deleted dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log("Category service running"));
