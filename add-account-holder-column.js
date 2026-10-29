const sql = require("mssql");
require("dotenv").config();

async function main() {
    const config = {
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: {
            encrypt: process.env.DB_ENCRYPT === "true",
            trustServerCertificate:
                process.env.DB_TRUST_SERVER_CERTIFICATE === "true"
        }
    };

    if (!config.server || !config.database) {
        throw new Error("DB_SERVER or DB_DATABASE missing in .env");
    }

    const pool = await sql.connect(config);

    const check = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = 'EmployeeMaster'
          AND COLUMN_NAME = 'AccountHolderName'
    `);

    if (check.recordset.length === 0) {
        await pool.request().query(`
            ALTER TABLE dbo.EmployeeMaster
            ADD AccountHolderName NVARCHAR(200) NULL
        `);
        console.log("Added dbo.EmployeeMaster.AccountHolderName");
    } else {
        console.log("AccountHolderName column already exists.");
    }

    const columns = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = 'EmployeeMaster'
        ORDER BY ORDINAL_POSITION
    `);

    console.table(columns.recordset);
    await pool.close();
}

main().catch(error => {
    console.error("DATABASE UPDATE FAILED:", error.message);
    process.exitCode = 1;
});
