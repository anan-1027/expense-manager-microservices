const express = require("express");
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");
const CircuitBreaker = require("opossum");
require("dotenv").config();

const app = express();
app.use(express.json());

/* ================== Database Connections ================== */
let pool;
const connectDBs = async () => {
    // MongoDB
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");
    } catch (e) { console.error("MongoDB Error", e); }

    // MySQL
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DB
        });
        await pool.query('CREATE TABLE IF NOT EXISTS expenses (id INT AUTO_INCREMENT PRIMARY KEY, mongo_id VARCHAR(50), title VARCHAR(255), amount DECIMAL(10,2), category VARCHAR(255), date DATE)');
        console.log("MySQL Connected");

        // Sync: MongoDB -> MySQL (One-time)
        const expenses = await Expense.find();
        for (const exp of expenses) {
            const [rows] = await pool.query("SELECT * FROM expenses WHERE mongo_id = ?", [exp._id.toString()]);
            if (rows.length === 0) {
                await pool.execute(
                    "INSERT INTO expenses (mongo_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?)",
                    [exp._id.toString(), exp.title, exp.amount, exp.category, exp.date]
                );
            }
        }
    } catch (e) { console.error("MySQL Error", e); }
};

/* ================== Schema ================== */
const ExpenseSchema = new mongoose.Schema({
    title: String,
    amount: Number,
    category: String,
    date: Date
});
const Expense = mongoose.model("Expense", ExpenseSchema);

connectDBs();

/* ================== Circuit Breaker Logic ================== */

// Function to perform dual database write
const dbWriteAction = async ({ type, payload, id }) => {
    if (type === 'CREATE') {
        const { title, amount, category, date } = payload;
        const newExp = new Expense({ title, amount, category, date });
        const saved = await newExp.save();
        await pool.execute(
            "INSERT INTO expenses (mongo_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?)",
            [saved._id.toString(), title, amount, category, date]
        );
        return "Created successfully";
    } else if (type === 'DELETE') {
        await Expense.findByIdAndDelete(id);
        await pool.execute("DELETE FROM expenses WHERE mongo_id = ?", [id]);
        return "Deleted successfully";
    }
    throw new Error("Unknown action type");
};

const breakerOptions = {
    timeout: 3000, // 3 seconds timeout
    errorThresholdPercentage: 50, // Open if 50% fails
    resetTimeout: 10000 // Retry after 10s
};

const breaker = new CircuitBreaker(dbWriteAction, breakerOptions);

// Fallback when circuit is OPEN
breaker.fallback(() => ({ error: "Circuit Breaker Active: Service temporarily unavailable due to database issues." }));

// Monitoring
breaker.on('open', () => console.log('CIRCUIT BREAKER: OPEN (Failures detected)'));
breaker.on('halfOpen', () => console.log('CIRCUIT BREAKER: HALF_OPEN (Testing recovery)'));
breaker.on('close', () => console.log('CIRCUIT BREAKER: CLOSED (Recovered)'));

/* ================== Routes ================== */

// ✅ READ from MongoDB
app.get("/expenses", async (req, res) => {
    try {
        const data = await Expense.find();
        res.json(data);
    } catch (err) { res.status(500).send(err.message); }
});

// ✅ STORE in BOTH (Protected by Circuit Breaker)
app.post("/expenses", async (req, res) => {
    const result = await breaker.fire({ type: 'CREATE', payload: req.body });
    if (result.error) {
        return res.status(503).json(result);
    }
    res.send(result);
});

app.delete("/expenses/:id", async (req, res) => {
    const result = await breaker.fire({ type: 'DELETE', id: req.params.id });
    if (result.error) {
        return res.status(503).json(result);
    }
    res.send(result);
});

app.listen(3000, () => console.log("Expense service running with Circuit Breaker"));
