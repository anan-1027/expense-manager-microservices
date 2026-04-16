const express = require("express");
const stompit = require("stompit");
const mysql = require("mysql2/promise");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());

/* ================== Database Connections ================== */
let pool;
const connectDBs = async () => {
    // MySQL
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });
        await pool.query('CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), password VARCHAR(255))');
        console.log("MySQL Connected");
    } catch (e) { console.error("MySQL Error", e); }

    // MongoDB
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");
        
        // Data Sync: MySQL -> MongoDB (One-time)
        const [rows] = await pool.query("SELECT * FROM users");
        for (const row of rows) {
            const exists = await User.findOne({ email: row.email });
            if (!exists) {
                await new User({ id: row.id, name: row.name, email: row.email, password: row.password }).save();
            }
        }
    } catch (e) { console.error("MongoDB Error", e); }
};
connectDBs();

/* ================== MongoDB Schema ================== */
const UserSchema = new mongoose.Schema({
    id: Number, // Reference to MySQL ID
    name: String,
    email: String,
    password: String
});
const User = mongoose.model("User", UserSchema);

/* ================== Routes ================== */

// ✅ READ from MongoDB
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) { res.status(500).send(err.message); }
});

// ✅ STORE in BOTH
app.post("/users", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // 1. MySQL
        const [result] = await pool.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name, email, password]
        );
        const newId = result.insertId;

        // 2. MongoDB
        const newUser = new User({ id: newId, name, email, password });
        await newUser.save();

        res.send("User saved in both databases");
    } catch (err) { res.status(500).send(err.message); }
});

app.put("/users/:id", async (req, res) => {
    try {
        const id = req.params.id; // Could be numeric string (MySQL id) or MongoDB _id
        const { name, email, password } = req.body;

        // Update MySQL (using numeric id if possible)
        if (!isNaN(id)) {
            await pool.execute(
                "UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password = COALESCE(?, password) WHERE id = ?",
                [name, email, password, id]
            );
        }

        // Update MongoDB (try by id or _id)
        const filter = isNaN(id) ? { _id: id } : { id: parseInt(id) };
        await User.findOneAndUpdate(filter, { name, email, password });

        res.send("User updated in both databases");
    } catch (err) { res.status(500).send(err.message); }
});

app.delete("/users/:id", async (req, res) => {
    try {
        const id = req.params.id;

        // 1. MySQL
        if (!isNaN(id)) {
            await pool.execute("DELETE FROM users WHERE id = ?", [id]);
        }

        // 2. MongoDB
        const filter = isNaN(id) ? { _id: id } : { id: parseInt(id) };
        await User.deleteOne(filter);

        res.send("User deleted from both databases");
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(3000, () => console.log("User service running on 3000"));
