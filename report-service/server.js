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
        await pool.query('CREATE TABLE IF NOT EXISTS reports (id INT AUTO_INCREMENT PRIMARY KEY, total DECIMAL(10, 2), date DATE)');
        console.log("MySQL Connected");

        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");

        // Sync: MySQL -> MongoDB
        const [rows] = await pool.query("SELECT * FROM reports");
        for (const row of rows) {
            const exists = await Report.findOne({ mysql_id: row.id });
            if (!exists) {
                await new Report({ mysql_id: row.id, total: row.total, date: row.date }).save();
            }
        }
    } catch (e) { console.error("Connection Error", e); }
};

/* ================== Schema ================== */
const ReportSchema = new mongoose.Schema({ mysql_id: Number, total: Number, date: Date });
const Report = mongoose.model("Report", ReportSchema);

connectDBs();

/* ================== Routes ================== */

app.get("/reports", async (req, res) => {
    try {
        const data = await Report.find();
        const mapped = data.map(d => ({ id: d.mysql_id, _id: d._id, total: d.total, date: d.date }));
        res.json(mapped);
    } catch (err) { res.status(500).send(err.message); }
});

app.post("/reports", async (req, res) => {
    try {
        const { total, date } = req.body;
        
        // 1. MySQL
        const [result] = await pool.execute("INSERT INTO reports (total, date) VALUES (?, ?)", [total, date]);
        const newId = result.insertId;

        // 2. MongoDB
        await new Report({ mysql_id: newId, total, date }).save();

        res.send("Report saved dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.delete("/reports/:id", async (req, res) => {
    try {
        const id = req.params.id;
        // 1. MySQL
        if (!isNaN(id)) {
            await pool.execute("DELETE FROM reports WHERE id = ?", [id]);
        }
        // 2. MongoDB
        const filter = isNaN(id) ? { _id: id } : { mysql_id: parseInt(id) };
        await Report.deleteOne(filter);

        res.send("Report deleted dual");
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log("Report service running"));
