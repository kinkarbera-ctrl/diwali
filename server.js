require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const sql = require("mssql");
const XLSX = require("xlsx");

const app = express();

/* =========================================================
   BASIC CONFIG
   ========================================================= */

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "50mb"
    })
);

const PUBLIC_DIR =
    path.join(__dirname, "public");

const PHOTO_DIR =
    path.join(
        PUBLIC_DIR,
        "photos"
    );

app.use(
    express.static(PUBLIC_DIR)
);


/* =========================================================
   SQL SERVER CONFIG
   SQL AUTHENTICATION - SA
   ========================================================= */

const dbConfig = {

    server:
        process.env.DB_SERVER ||
        "10.0.50.4",

    port:
        Number(
            process.env.DB_PORT ||
            1433
        ),

    database:
        process.env.DB_DATABASE ||
        "DiwaliPrizeDB",

    user:
        process.env.DB_USER ||
        "sa",

    password:
        process.env.DB_PASSWORD ||
        "",

    options: {

        encrypt:
            String(
                process.env.DB_ENCRYPT ||
                "false"
            ).toLowerCase() === "true",

        trustServerCertificate:
            String(
                process.env.DB_TRUST_SERVER_CERTIFICATE ||
                "true"
            ).toLowerCase() === "true"
    },

    pool: {

        max: 10,

        min: 0,

        idleTimeoutMillis: 30000
    },

    connectionTimeout: 15000,

    requestTimeout: 30000
};


/* =========================================================
   SQL CONNECTION
   ========================================================= */

let poolPromise = null;


function getPool() {

    if (!poolPromise) {

        poolPromise =
            sql
                .connect(dbConfig)
                .then(
                    pool => {

                        console.log(
                            "SQL SERVER : CONNECTED"
                        );

                        return pool;

                    }
                )
                .catch(
                    error => {

                        poolPromise = null;

                        console.error(
                            "SQL SERVER CONNECTION ERROR:"
                        );

                        console.error(
                            error.message
                        );

                        throw error;

                    }
                );

    }

    return poolPromise;
}


/* =========================================================
   PRIZE LIST
   ========================================================= */

function getPrizeList() {

    const prizes = [];


    /*
       10.10 -> 10.01
    */

    for (
        let i = 10;
        i >= 1;
        i--
    ) {

        prizes.push(
            "10." +
            String(i).padStart(2, "0")
        );

    }


    /*
       9.9 -> 9.1
       8.8 -> 8.1
       ...
       2.2 -> 2.1
    */

    for (
        let group = 9;
        group >= 2;
        group--
    ) {

        for (
            let i = group;
            i >= 1;
            i--
        ) {

            prizes.push(
                group + "." + i
            );

        }

    }


    /*
       1.1
    */

    prizes.push(
        "1.1"
    );


    return prizes;
}


const PRIZES =
    getPrizeList();


/* =========================================================
   HELPERS
   ========================================================= */

function clean(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(
            /\u00A0/g,
            " "
        )
        .trim();

}


function normalize(value) {

    return clean(value)
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   PHOTO HELPERS
   ========================================================= */

const PHOTO_EXTENSIONS = [

    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif"

];


function getPhotoFiles() {

    try {

        if (
            !fs.existsSync(
                PHOTO_DIR
            )
        ) {

            return [];

        }


        return fs
            .readdirSync(
                PHOTO_DIR,
                {
                    withFileTypes: true
                }
            )
            .filter(
                item => {

                    return (

                        item.isFile() &&

                        PHOTO_EXTENSIONS.includes(
                            path
                                .extname(
                                    item.name
                                )
                                .toLowerCase()
                        )

                    );

                }
            )
            .map(
                item =>
                    item.name
            );

    }
    catch (error) {

        console.error(
            "PHOTO FOLDER ERROR:",
            error.message
        );

        return [];

    }

}


function buildPhotoIndex() {

    const files =
        getPhotoFiles();


    const index =
        new Map();


    for (
        const file
        of files
    ) {

        const baseName =
            path.parse(
                file
            ).name;


        const key =
            normalize(
                baseName
            );


        if (
            key &&
            !index.has(key)
        ) {

            index.set(
                key,
                file
            );

        }

    }


    return index;

}


function findEmployeePhoto({

    couponNo,
    employeeCode,
    sapCode,
    employeeName,
    photo

}) {

    const index =
        buildPhotoIndex();


    /*
       Existing photo
    */

    const suppliedPhoto =
        clean(photo);


    if (
        suppliedPhoto
    ) {

        const suppliedBase =
            path.basename(
                suppliedPhoto
                    .replace(
                        /\\/g,
                        "/"
                    )
            );


        const suppliedName =
            path.parse(
                suppliedBase
            ).name;


        const suppliedKey =
            normalize(
                suppliedName
            );


        if (
            index.has(
                suppliedKey
            )
        ) {

            return (
                "/photos/" +
                encodeURIComponent(
                    index.get(
                        suppliedKey
                    )
                )
            );

        }

    }


    /*
       Coupon / Employee / SAP
    */

    const searchValues = [

        couponNo,
        employeeCode,
        sapCode

    ];


    for (
        const value
        of searchValues
    ) {

        const key =
            normalize(
                value
            );


        if (!key) {

            continue;

        }


        if (
            index.has(
                key
            )
        ) {

            return (
                "/photos/" +
                encodeURIComponent(
                    index.get(
                        key
                    )
                )
            );

        }

    }


    /*
       Employee name
    */

    const nameKey =
        normalize(
            employeeName
        );


    if (
        nameKey &&
        index.has(
            nameKey
        )
    ) {

        return (
            "/photos/" +
            encodeURIComponent(
                index.get(
                    nameKey
                )
            )
        );

    }


    /*
       Numeric matching
    */

    const numericCandidates = [

        couponNo,
        employeeCode,
        sapCode

    ]
        .map(
            clean
        )
        .filter(
            Boolean
        )
        .map(
            value =>
                value.replace(
                    /\.0+$/,
                    ""
                )
        );


    for (
        const file
        of index.values()
    ) {

        const base =
            path.parse(
                file
            ).name;


        const normalizedBase =
            normalize(
                base
            )
            .replace(
                /\.0+$/,
                ""
            );


        if (
            numericCandidates.includes(
                normalizedBase
            )
        ) {

            return (
                "/photos/" +
                encodeURIComponent(
                    file
                )
            );

        }

    }


    return "";

}


/* =========================================================
   HOME
   ========================================================= */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                "index.html"
            )
        );

    }
);


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            const pool =
                await getPool();


            const result =
                await pool
                    .request()
                    .query(
                        `
                        SELECT
                            1 AS OK,
                            @@SERVERNAME AS ServerName,
                            DB_NAME() AS DatabaseName
                        `
                    );


            res.json({

                success: true,

                message:
                    "SQL Server connection OK",

                server:
                    result.recordset[0].ServerName,

                database:
                    result.recordset[0].DatabaseName

            });

        }
        catch (error) {

            console.error(
                "DATABASE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   CURRENT PRIZE
   ========================================================= */

app.get(
    "/api/current-prize",
    async (req, res) => {

        try {

            const pool =
                await getPool();


            const result =
                await pool
                    .request()
                    .query(`
                        SELECT PrizeNo
                        FROM dbo.PrizeWinner
                    `);


            const saved =
                new Set(
                    result.recordset.map(
                        x =>
                            String(
                                x.PrizeNo
                            ).trim()
                    )
                );


            const nextPrize =
                PRIZES.find(
                    p =>
                        !saved.has(
                            String(p)
                        )
                );


            res.json({

                success: true,

                prizeNo:
                    nextPrize ||
                    "COMPLETED"

            });

        }
        catch (error) {

            console.error(
                "CURRENT PRIZE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   EMPLOYEES
   ========================================================= */

app.get(
    "/api/employees",
    async (req, res) => {

        try {

            const pool =
                await getPool();


            const result =
                await pool
                    .request()
                    .query(`
                        SELECT
                            ID AS id,
                            CouponNo AS couponNo,
                            EmployeeCode AS employeeCode,
                            SAPCode AS sapCode,
                            EmployeeName AS name,
                            AccountHolderName AS couponHolderName,
                            AccountHolderName AS accountHolderName,
                            Department AS department,
                            Designation AS designation,
                            Unit AS unit,
                            Photo AS photo

                        FROM dbo.EmployeeMaster

                        ORDER BY ID
                    `);


            res.json({

                success: true,

                employees:
                    result.recordset

            });

        }
        catch (error) {

            console.error(
                "EMPLOYEE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   EMPLOYEE CRUD ROUTES - FIX FOR MASTER DATA SAVE
   ========================================================= */
app.post("/api/employees", async (req, res) => {
    try {
        const b = req.body || {};
        const couponNo = clean(b.couponNo);
        const employeeCode = clean(b.employeeCode);
        const sapCode = clean(b.sapCode);
        const name = clean(b.name || b.employeeName);
                const accountHolderName = clean(b.couponHolderName || b.accountHolderName);
const department = clean(b.department);
        const designation = clean(b.designation);
        const unit = clean(b.unit);
        const photo = clean(b.photo);
        if (!couponNo || !name) return res.status(400).json({ success:false, message:"Coupon No and Employee Name are required." });
        const pool = await getPool();
        const duplicate = await pool.request()
            .input("CouponNo", sql.NVarChar(50), couponNo)
            .query("SELECT TOP 1 ID FROM dbo.EmployeeMaster WHERE LTRIM(RTRIM(CAST(CouponNo AS NVARCHAR(50))))=@CouponNo");
        if (duplicate.recordset.length) return res.status(409).json({ success:false, message:"Coupon No already exists." });
        const result = await pool.request()
            .input("CouponNo", sql.NVarChar(50), couponNo)
            .input("EmployeeCode", sql.NVarChar(50), employeeCode)
            .input("SAPCode", sql.NVarChar(50), sapCode)
            .input("EmployeeName", sql.NVarChar(200), name)
            
            .input("AccountHolderName", sql.NVarChar(200), accountHolderName).input("Department", sql.NVarChar(150), department)
            .input("Designation", sql.NVarChar(150), designation)
            .input("Unit", sql.NVarChar(100), unit)
            .input("Photo", sql.NVarChar(500), photo)
            .query(`INSERT INTO dbo.EmployeeMaster (CouponNo,EmployeeCode,SAPCode,EmployeeName,AccountHolderName,Department,Designation,Unit,Photo)
                    OUTPUT INSERTED.ID AS id, INSERTED.CouponNo AS couponNo, INSERTED.EmployeeCode AS employeeCode,
                    INSERTED.SAPCode AS sapCode, INSERTED.EmployeeName AS name, INSERTED.AccountHolderName AS couponHolderName, INSERTED.AccountHolderName AS accountHolderName,
                    INSERTED.Department AS department,
                    INSERTED.Designation AS designation, INSERTED.Unit AS unit, INSERTED.Photo AS photo
                    VALUES (@CouponNo,@EmployeeCode,@SAPCode,@EmployeeName,@AccountHolderName,@Department,@Designation,@Unit,@Photo)`);
        res.status(201).json({ success:true, employee:result.recordset[0] });
    } catch (error) {
        console.error("EMPLOYEE SAVE ERROR:", error);
        res.status(500).json({ success:false, message:error.message || "Employee save failed." });
    }
});

app.put("/api/employees/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success:false, message:"Invalid employee ID." });
        const b = req.body || {};
        const couponNo = clean(b.couponNo);
        const employeeCode = clean(b.employeeCode);
        const sapCode = clean(b.sapCode);
        const name = clean(b.name || b.employeeName);
                const accountHolderName = clean(b.couponHolderName || b.accountHolderName);
const department = clean(b.department);
        const designation = clean(b.designation);
        const unit = clean(b.unit);
        const photo = clean(b.photo);
        if (!couponNo || !name) return res.status(400).json({ success:false, message:"Coupon No and Employee Name are required." });
        const pool = await getPool();
        const duplicate = await pool.request()
            .input("ID", sql.Int, id).input("CouponNo", sql.NVarChar(50), couponNo)
            .query("SELECT TOP 1 ID FROM dbo.EmployeeMaster WHERE LTRIM(RTRIM(CAST(CouponNo AS NVARCHAR(50))))=@CouponNo AND ID<>@ID");
        if (duplicate.recordset.length) return res.status(409).json({ success:false, message:"Coupon No already exists on another employee." });
        const result = await pool.request()
            .input("ID", sql.Int, id).input("CouponNo", sql.NVarChar(50), couponNo)
            .input("EmployeeCode", sql.NVarChar(50), employeeCode).input("SAPCode", sql.NVarChar(50), sapCode)
            .input("EmployeeName", sql.NVarChar(200), name)
            .input("AccountHolderName", sql.NVarChar(200), accountHolderName).input("Department", sql.NVarChar(150), department)
            .input("Designation", sql.NVarChar(150), designation).input("Unit", sql.NVarChar(100), unit)
            .input("Photo", sql.NVarChar(500), photo)
            .query(`UPDATE dbo.EmployeeMaster SET CouponNo=@CouponNo, EmployeeCode=@EmployeeCode, SAPCode=@SAPCode,
                    EmployeeName=@EmployeeName, AccountHolderName=@AccountHolderName,
                    Department=@Department, Designation=@Designation, Unit=@Unit, Photo=@Photo
                    WHERE ID=@ID;
                    SELECT ID AS id, CouponNo AS couponNo, EmployeeCode AS employeeCode, SAPCode AS sapCode,
                    EmployeeName AS name, AccountHolderName AS couponHolderName, AccountHolderName AS accountHolderName,
                    Department AS department, Designation AS designation, Unit AS unit, Photo AS photo
                    FROM dbo.EmployeeMaster WHERE ID=@ID`);
        if (!result.recordset.length) return res.status(404).json({ success:false, message:"Employee not found." });
        res.json({ success:true, employee:result.recordset[0] });
    } catch (error) {
        console.error("EMPLOYEE UPDATE ERROR:", error);
        res.status(500).json({ success:false, message:error.message || "Employee update failed." });
    }
});

app.delete("/api/employees/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success:false, message:"Invalid employee ID." });
        const pool = await getPool();
        const result = await pool.request().input("ID", sql.Int, id)
            .query("DELETE FROM dbo.EmployeeMaster WHERE ID=@ID; SELECT @@ROWCOUNT AS affected");
        if (!result.recordset?.[0]?.affected) return res.status(404).json({ success:false, message:"Employee not found." });
        res.json({ success:true, message:"Employee deleted." });
    } catch (error) {
        console.error("EMPLOYEE DELETE ERROR:", error);
        res.status(500).json({ success:false, message:error.message || "Employee delete failed." });
    }
});

/* =========================================================
   SEARCH EMPLOYEE
   ========================================================= */

app.get(
    "/api/search/:value",
    async (req, res) => {

        try {

            const value =
                clean(
                    req.params.value
                );


            if (!value) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Search value required."

                });

            }


            const pool =
                await getPool();


            const result =
                await pool
                    .request()

                    .input(
                        "value",
                        sql.NVarChar(100),
                        value
                    )

                    .query(`
                        SELECT TOP 1
                            ID AS id,
                            CouponNo AS couponNo,
                            EmployeeCode AS employeeCode,
                            SAPCode AS sapCode,
                            EmployeeName AS name,
                            Department AS department,
                            Designation AS designation,
                            Unit AS unit,
                            Photo AS photo

                        FROM dbo.EmployeeMaster

                        WHERE

                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        ISNULL(
                                            CouponNo,
                                            ''
                                        )
                                    )
                                )
                            )
                            =
                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        @value
                                    )
                                )
                            )

                            OR

                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        ISNULL(
                                            EmployeeCode,
                                            ''
                                        )
                                    )
                                )
                            )
                            =
                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        @value
                                    )
                                )
                            )

                            OR

                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        ISNULL(
                                            SAPCode,
                                            ''
                                        )
                                    )
                                )
                            )
                            =
                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        @value
                                    )
                                )
                            )

                        ORDER BY ID
                    `);


            if (
                !result.recordset.length
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Employee not found."

                });

            }


            const employee =
                result.recordset[0];


            const foundPhoto =
                findEmployeePhoto({

                    couponNo:
                        employee.couponNo,

                    employeeCode:
                        employee.employeeCode,

                    sapCode:
                        employee.sapCode,

                    employeeName:
                        employee.name,

                    photo:
                        employee.photo

                });


            if (
                foundPhoto
            ) {

                employee.photo =
                    foundPhoto;

            }


            res.json({

                success: true,

                employee:
                    employee

            });

        }
        catch (error) {

            console.error(
                "SEARCH ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   EMPLOYEE EXCEL TEMPLATE DOWNLOAD
   ========================================================= */

app.get("/api/employees/template", (req, res) => {
    try {
        const headers = [[
            "Coupon No",
            "Coupon Holder Name",
            "Employee Code",
            "SAP Code",
            "Employee Name",
            "Department",
            "Designation",
            "Unit",
            "Photo"
        ]];
        const worksheet = XLSX.utils.aoa_to_sheet(headers);
        worksheet["!cols"] = [
            { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 16 },
            { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 36 }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Template");
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
        res.setHeader("Content-Disposition", 'attachment; filename="Employee-Coupon-Holder-Template.xlsx"');
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
    } catch (error) {
        console.error("EMPLOYEE TEMPLATE ERROR:", error);
        res.status(500).json({ success: false, message: error.message || "Template download failed." });
    }
});

/* =========================================================
   EXPORT EMPLOYEES
   ========================================================= */

app.get(
    "/api/employees/export",
    async (req, res) => {

        try {

            const pool =
                await getPool();


            const result =
                await pool
                    .request()
                    .query(`
                        SELECT
                            CouponNo,
                            EmployeeCode,
                            SAPCode,
                            AccountHolderName,
                            EmployeeName,
                            Department,
                            Designation,
                            Unit,
                            Photo

                        FROM dbo.EmployeeMaster

                        ORDER BY EmployeeName
                    `);


            const rows =
                result.recordset.map(
                    row => ({

                        "Coupon No":
                            row.CouponNo || "",

                        "Employee Code":
                            row.EmployeeCode || "",

                        "Coupon Holder Name":
                            row.AccountHolderName || "",

                        "SAP Code":
                            row.SAPCode || "",

                        "Employee Name":
                            row.EmployeeName || "",

                        "Department":
                            row.Department || "",

                        "Designation":
                            row.Designation || "",

                        "Unit":
                            row.Unit || "",

                        "Photo":
                            row.Photo || ""

                    })
                );


            const worksheet =
                XLSX.utils.json_to_sheet(
                    rows
                );


            const workbook =
                XLSX.utils.book_new();


            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                "Employees"
            );


            const buffer =
                XLSX.write(
                    workbook,
                    {
                        type: "buffer",
                        bookType: "xlsx"
                    }
                );


            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );


            res.setHeader(
                "Content-Disposition",
                'attachment; filename="EmployeeMaster.xlsx"'
            );


            res.send(
                buffer
            );

        }
        catch (error) {

            console.error(
                "EXCEL EXPORT ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Excel export failed: " +
                    error.message

            });

        }

    }
);


/* =========================================================
   SAVE PRIZE
   ========================================================= */

app.post(
    "/api/prizes",
    async (req, res) => {

        try {

            const body =
                req.body || {};


            const prizeNo =
                clean(
                    body.prizeNo
                );


            const couponNo =
                clean(
                    body.couponNo
                );


            if (!prizeNo) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Prize No required."

                });

            }


            if (!couponNo) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Coupon No required."

                });

            }


            const pool =
                await getPool();


            /*
               CHECK PRIZE
            */

            const prizeCheck =
                await pool
                    .request()

                    .input(
                        "prizeNo",
                        sql.NVarChar(20),
                        prizeNo
                    )

                    .query(`
                        SELECT TOP 1 ID

                        FROM dbo.PrizeWinner

                        WHERE PrizeNo = @prizeNo
                    `);


            if (
                prizeCheck.recordset.length
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Prize " +
                        prizeNo +
                        " is already saved."

                });

            }


            /*
               CHECK COUPON
            */

            const couponCheck =
                await pool
                    .request()

                    .input(
                        "couponNo",
                        sql.NVarChar(50),
                        couponNo
                    )

                    .query(`
                        SELECT TOP 1 ID

                        FROM dbo.PrizeWinner

                        WHERE

                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        CouponNo
                                    )
                                )
                            )
                            =
                            LOWER(
                                LTRIM(
                                    RTRIM(
                                        @couponNo
                                    )
                                )
                            )
                    `);


            if (
                couponCheck.recordset.length
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This Coupon No has already won a prize."

                });

            }


            /*
               PHOTO
            */

            let photo =
                clean(
                    body.photo
                );


            if (!photo) {

                photo =
                    findEmployeePhoto({

                        couponNo:
                            couponNo,

                        employeeCode:
                            body.employeeCode,

                        sapCode:
                            body.sapCode,

                        employeeName:
                            body.employeeName,

                        photo:
                            body.photo

                    });

            }


            /*
               INSERT
            */

            const insertResult =
                await pool
                    .request()

                    .input(
                        "prizeNo",
                        sql.NVarChar(20),
                        prizeNo
                    )

                    .input(
                        "couponNo",
                        sql.NVarChar(50),
                        couponNo
                    )

                    .input(
                        "employeeCode",
                        sql.NVarChar(50),
                        clean(
                            body.employeeCode
                        )
                    )

                    .input(
                        "sapCode",
                        sql.NVarChar(50),
                        clean(
                            body.sapCode
                        )
                    )

                    .input(
                        "employeeName",
                        sql.NVarChar(200),
                        clean(
                            body.employeeName
                        )
                    )

                    .input(
                        "department",
                        sql.NVarChar(150),
                        clean(
                            body.department
                        )
                    )

                    .input(
                        "designation",
                        sql.NVarChar(150),
                        clean(
                            body.designation
                        )
                    )

                    .input(
                        "unit",
                        sql.NVarChar(100),
                        clean(
                            body.unit
                        )
                    )

                    .input(
                        "photo",
                        sql.NVarChar(500),
                        photo
                    )

                    .query(`
                        INSERT INTO dbo.PrizeWinner
                        (
                            PrizeNo,
                            CouponNo,
                            EmployeeCode,
                            SAPCode,
                            EmployeeName,
                            Department,
                            Designation,
                            Unit,
                            Photo
                        )

                        OUTPUT
                            INSERTED.ID,
                            INSERTED.PrizeNo,
                            INSERTED.CouponNo,
                            INSERTED.EmployeeCode,
                            INSERTED.SAPCode,
                            INSERTED.EmployeeName,
                            INSERTED.Department,
                            INSERTED.Designation,
                            INSERTED.Unit,
                            INSERTED.Photo,
                            INSERTED.WinnerDate

                        VALUES
                        (
                            @prizeNo,
                            @couponNo,
                            @employeeCode,
                            @sapCode,
                            @employeeName,
                            @department,
                            @designation,
                            @unit,
                            @photo
                        )
                    `);


            const record =
                insertResult.recordset[0];


            res.json({

                success: true,

                message:
                    "Prize saved successfully.",

                record: {

                    id:
                        record.ID,

                    prizeNo:
                        record.PrizeNo,

                    couponNo:
                        record.CouponNo,

                    employeeCode:
                        record.EmployeeCode,

                    sapCode:
                        record.SAPCode,

                    employeeName:
                        record.EmployeeName,

                    department:
                        record.Department,

                    designation:
                        record.Designation,

                    unit:
                        record.Unit,

                    photo:
                        record.Photo,

                    date:
                        record.WinnerDate,

                    status:
                        "Winner"

                }

            });

        }
        catch (error) {

            console.error(
                "SAVE PRIZE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   GET ALL PRIZES
   ========================================================= */

app.get(
    "/api/prizes",
    async (req, res) => {

        try {

            const pool =
                await getPool();


            const result =
                await pool
                    .request()
                    .query(`
                        SELECT
                            ID,
                            PrizeNo,
                            CouponNo,
                            EmployeeCode,
                            SAPCode,
                            EmployeeName,
                            emp.CouponHolderName AS CouponHolderName,
                            Department,
                            Designation,
                            Unit,
                            Photo,
                            WinnerDate

                        FROM dbo.PrizeWinner AS pw

                        OUTER APPLY (
                            SELECT TOP (1)
                                em.AccountHolderName AS CouponHolderName
                            FROM dbo.EmployeeMaster AS em
                            WHERE
                                (
                                    NULLIF(LTRIM(RTRIM(pw.CouponNo)), '') IS NOT NULL
                                    AND LTRIM(RTRIM(em.CouponNo)) = LTRIM(RTRIM(pw.CouponNo))
                                )
                                OR
                                (
                                    NULLIF(LTRIM(RTRIM(pw.SAPCode)), '') IS NOT NULL
                                    AND LTRIM(RTRIM(em.SAPCode)) = LTRIM(RTRIM(pw.SAPCode))
                                )
                            ORDER BY
                                CASE
                                    WHEN LTRIM(RTRIM(em.CouponNo)) = LTRIM(RTRIM(pw.CouponNo))
                                    THEN 0
                                    ELSE 1
                                END
                        ) AS emp

                        ORDER BY pw.ID
                    `);


            const prizes =
                result.recordset.map(
                    x => {

                        let photo =
                            clean(
                                x.Photo
                            );


                        if (
                            !photo ||
                            photo.includes(
                                ":\\"
                            ) ||
                            photo.includes(
                                ":/"
                            ) ||
                            photo
                                .toLowerCase()
                                .includes(
                                    "public/photos"
                                )
                        ) {

                            const found =
                                findEmployeePhoto({

                                    couponNo:
                                        x.CouponNo,

                                    employeeCode:
                                        x.EmployeeCode,

                                    sapCode:
                                        x.SAPCode,

                                    employeeName:
                                        x.EmployeeName,

                                    photo:
                                        x.Photo

                                });


                            if (
                                found
                            ) {

                                photo =
                                    found;

                            }

                        }


                        return {

                            id:
                                x.ID,

                            prizeNo:
                                x.PrizeNo,

                            couponNo:
                                x.CouponNo,

                            employeeCode:
                                x.EmployeeCode,

                            sapCode:
                                x.SAPCode,

                            employeeName:
                                x.EmployeeName,

                            couponHolderName:
                                x.CouponHolderName,

                            accountHolderName:
                                x.CouponHolderName,

                            department:
                                x.Department,

                            designation:
                                x.Designation,

                            unit:
                                x.Unit,

                            photo:
                                photo,

                            date:
                                x.WinnerDate,

                            status:
                                "Winner"

                        };

                    }
                );


            res.json({

                success: true,

                prizes:
                    prizes

            });

        }
        catch (error) {

            console.error(
                "PRIZES ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   CLEAR ALL PRIZES
   ========================================================= */

async function clearAllPrizes(
    req,
    res
) {

    try {

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "CLEAR ALL PRIZES REQUEST RECEIVED"
        );

        console.log(
            "Method:",
            req.method
        );

        console.log(
            "=========================================="
        );


        const pool =
            await getPool();


        /*
           COUNT FIRST
        */

        const countResult =
            await pool
                .request()
                .query(`
                    SELECT COUNT(*) AS Total
                    FROM dbo.PrizeWinner
                `);


        const beforeCount =
            Number(
                countResult
                    .recordset[0]
                    .Total || 0
            );


        console.log(
            "Prize records before delete:",
            beforeCount
        );


        /*
           DELETE ALL
        */

        const deleteResult =
            await pool
                .request()
                .query(`
                    DELETE FROM dbo.PrizeWinner
                `);


        const deleted =
            Number(
                deleteResult
                    .rowsAffected[0] || 0
            );


        console.log(
            "Prize records deleted:",
            deleted
        );


        /*
           RESET IDENTITY
        */

        try {

            await pool
                .request()
                .query(`
                    DBCC CHECKIDENT
                    ('dbo.PrizeWinner', RESEED, 0)
                `);


            console.log(
                "Identity reset successfully."
            );

        }
        catch (seedError) {

            console.log(
                "Identity reset skipped:",
                seedError.message
            );

        }


        /*
           VERIFY
        */

        const verifyResult =
            await pool
                .request()
                .query(`
                    SELECT COUNT(*) AS Total
                    FROM dbo.PrizeWinner
                `);


        const remaining =
            Number(
                verifyResult
                    .recordset[0]
                    .Total || 0
            );


        console.log(
            "Prize records remaining:",
            remaining
        );


        res.json({

            success:
                remaining === 0,

            message:
                remaining === 0
                    ? "All prize winner records cleared successfully."
                    : "Some prize records could not be cleared.",

            deleted:
                deleted,

            remaining:
                remaining

        });

    }
    catch (error) {

        console.error("");
        console.error(
            "=========================================="
        );

        console.error(
            "CLEAR ALL PRIZES ERROR"
        );

        console.error(
            "=========================================="
        );

        console.error(
            error
        );

        console.error("");


        res.status(500).json({

            success: false,

            message:
                "Database delete failed: " +
                error.message

        });

    }

}


/* =========================================================
   CLEAR ALL ROUTES
   IMPORTANT: ABOVE /:prizeNo
   ========================================================= */

app.delete(
    "/api/prizes/clear-all",
    clearAllPrizes
);

app.post(
    "/api/prizes/clear-all",
    clearAllPrizes
);


/* =========================================================
   DELETE ONE PRIZE
   ========================================================= */

app.delete(
    "/api/prizes/:prizeNo",
    async (req, res) => {

        try {

            const prizeNo =
                decodeURIComponent(
                    req.params.prizeNo
                );


            const pool =
                await getPool();


            const result =
                await pool
                    .request()

                    .input(
                        "prizeNo",
                        sql.NVarChar(20),
                        prizeNo
                    )

                    .query(`
                        DELETE FROM dbo.PrizeWinner

                        WHERE PrizeNo = @prizeNo
                    `);


            const deleted =
                Number(
                    result.rowsAffected[0] || 0
                );


            res.json({

                success: true,

                message:
                    deleted > 0
                        ? "Prize cleared."
                        : "Prize not found.",

                deleted:
                    deleted

            });

        }
        catch (error) {

            console.error(
                "DELETE PRIZE ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   EXCEL IMPORT
   ========================================================= */

app.post(
    "/api/employees/import",
    express.raw({ type: "application/octet-stream", limit: "50mb" }),
    async (req, res) => {

        try {

            let buffer = null;


            /*
               BASE64
            */

            if (
                req.body &&
                typeof req.body.file === "string"
            ) {

                let base64 =
                    req.body.file.trim();


                if (
                    base64.includes(",") &&
                    base64
                        .toLowerCase()
                        .startsWith("data:")
                ) {

                    base64 =
                        base64.split(",")[1];

                }


                buffer =
                    Buffer.from(
                        base64,
                        "base64"
                    );

            }


            /*
               BUFFER
            */

            else if (
                Buffer.isBuffer(
                    req.body
                )
            ) {

                buffer =
                    req.body;

            }


            /*
               JSON BUFFER
            */

            else if (
                req.body &&
                req.body.type === "Buffer" &&
                Array.isArray(
                    req.body.data
                )
            ) {

                buffer =
                    Buffer.from(
                        req.body.data
                    );

            }


            if (
                !Buffer.isBuffer(buffer) ||
                buffer.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Excel file data not received."

                });

            }


            const workbook =
                XLSX.read(
                    buffer,
                    {
                        type: "buffer",
                        cellDates: true
                    }
                );


            if (
                !workbook.SheetNames.length
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Excel sheet not found."

                });

            }


            const sheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];


            const rows =
                XLSX.utils.sheet_to_json(
                    sheet,
                    {
                        defval: "",
                        raw: false
                    }
                );


            if (
                !rows.length
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No data found in Excel file."

                });

            }


            const pool =
                await getPool();


            let added = 0;
            let skipped = 0;

            const errors = [];


            /*
               PROCESS ROWS
            */

            for (
                let rowIndex = 0;
                rowIndex < rows.length;
                rowIndex++
            ) {

                try {

                    const row =
                        rows[rowIndex];


                    const get =
                        (...names) => {

                            for (
                                const name
                                of names
                            ) {

                                const wanted =
                                    normalize(
                                        name
                                    );


                                const key =
                                    Object.keys(row)
                                        .find(
                                            k =>
                                                normalize(k)
                                                === wanted
                                        );


                                if (
                                    key !== undefined
                                ) {

                                    const value =
                                        clean(
                                            row[key]
                                        );


                                    if (
                                        value
                                    ) {

                                        return value;

                                    }

                                }

                            }


                            return "";

                        };


                    const couponNo =
                        get(
                            "Coupon No",
                            "CouponNo",
                            "Coupon",
                            "Coupon Number"
                        );


                    const employeeCode =
                        get(
                            "Employee Code",
                            "EmployeeCode",
                            "Emp Code",
                            "EmpCode"
                        );


                    const sapCode =
                        get(
                            "SAP Code",
                            "SAPCode",
                            "SAP"
                        );


                    const employeeName =
                        get(
                            "Employee Name",
                            "EmployeeName",
                            "Name"
                        );

                    const couponHolderName =
                        get(
                            "Coupon Holder Name",
                            "CouponHolderName",
                            "Account Holder Name",
                            "AccountHolderName",
                            "Employee Coupon Holder Name"
                        );


                    const department =
                        get(
                            "Department",
                            "Dept"
                        );


                    const designation =
                        get(
                            "Designation",
                            "Desig"
                        );


                    const unit =
                        get(
                            "Unit"
                        );


                    const excelPhoto =
                        get(
                            "Photo",
                            "Photo Path",
                            "PhotoPath",
                            "Photo Folder",
                            "PhotoFolder"
                        );


                    if (
                        !couponNo ||
                        !employeeName
                    ) {

                        skipped++;


                        errors.push(
                            "Row " +
                            (rowIndex + 2) +
                            ": Coupon No or Employee Name missing."
                        );


                        continue;

                    }


                    /*
                       DUPLICATE COUPON
                    */

                    const check =
                        await pool
                            .request()

                            .input(
                                "CouponNo",
                                sql.NVarChar(50),
                                couponNo
                            )

                            .query(`
                                SELECT TOP 1
                                    CouponNo

                                FROM dbo.EmployeeMaster

                                WHERE

                                    LOWER(
                                        LTRIM(
                                            RTRIM(
                                                CouponNo
                                            )
                                        )
                                    )
                                    =
                                    LOWER(
                                        LTRIM(
                                            RTRIM(
                                                @CouponNo
                                            )
                                        )
                                    )
                            `);


                    if (
                        check.recordset.length
                    ) {

                        skipped++;

                        continue;

                    }


                    /*
                       PHOTO
                    */

                    const foundPhoto =
                        findEmployeePhoto({

                            couponNo:
                                couponNo,

                            employeeCode:
                                employeeCode,

                            sapCode:
                                sapCode,

                            employeeName:
                                employeeName,

                            photo:
                                excelPhoto

                        });


                    const photo =
                        foundPhoto || "";


                    /*
                       INSERT EMPLOYEE
                    */

                    await pool
                        .request()

                        .input(
                            "CouponNo",
                            sql.NVarChar(50),
                            couponNo
                        )

                        .input(
                            "EmployeeCode",
                            sql.NVarChar(50),
                            employeeCode
                        )

                        .input(
                            "SAPCode",
                            sql.NVarChar(50),
                            sapCode
                        )

                        .input(
                            "EmployeeName",
                            sql.NVarChar(200),
                            employeeName
                        )

                        .input(
                            "AccountHolderName",
                            sql.NVarChar(200),
                            couponHolderName
                        )

                        .input(
                            "Department",
                            sql.NVarChar(150),
                            department
                        )

                        .input(
                            "Designation",
                            sql.NVarChar(150),
                            designation
                        )

                        .input(
                            "Unit",
                            sql.NVarChar(100),
                            unit
                        )

                        .input(
                            "Photo",
                            sql.NVarChar(500),
                            photo
                        )

                        .query(`
                            INSERT INTO dbo.EmployeeMaster
                            (
                                CouponNo,
                                EmployeeCode,
                                SAPCode,
                                EmployeeName,
                                AccountHolderName,
                                Department,
                                Designation,
                                Unit,
                                Photo
                            )

                            VALUES
                            (
                                @CouponNo,
                                @EmployeeCode,
                                @SAPCode,
                                @EmployeeName,
                                @AccountHolderName,
                                @Department,
                                @Designation,
                                @Unit,
                                @Photo
                            )
                        `);


                    added++;

                }
                catch (rowError) {

                    skipped++;


                    errors.push(
                        "Row " +
                        (rowIndex + 2) +
                        ": " +
                        rowError.message
                    );

                }

            }


            res.json({

                success: true,

                message:
                    "Excel import completed successfully.",

                added:
                    added,

                skipped:
                    skipped,

                total:
                    rows.length,

                errors:
                    errors

            });

        }
        catch (error) {

            console.error(
                "EXCEL IMPORT ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Excel import failed: " +
                    error.message

            });

        }

    }
);


/* =========================================================
   PHOTO TEST
   ========================================================= */

app.get(
    "/api/photo-test/:value",
    async (req, res) => {

        try {

            const value =
                clean(
                    req.params.value
                );


            const index =
                buildPhotoIndex();


            const key =
                normalize(
                    value
                );


            const file =
                index.get(
                    key
                );


            if (!file) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Photo not found.",

                    searched:
                        value,

                    folder:
                        PHOTO_DIR

                });

            }


            res.json({

                success: true,

                file:
                    file,

                url:
                    "/photos/" +
                    encodeURIComponent(
                        file
                    )

            });

        }
        catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================================
   PHOTO FOLDER
   ========================================================= */

app.get(
    "/api/photo-folder",
    (req, res) => {

        try {

            const files =
                getPhotoFiles();


            res.json({

                success: true,

                folder:
                    PHOTO_DIR,

                count:
                    files.length,

                files:
                    files.slice(
                        0,
                        100
                    )

            });

        }
        catch (error) {

            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


/* =========================================
/* =========================================================
   DEPARTMENT EMPLOYEE MANUAL ENTRY
   ========================================================= */
app.post("/api/employees/manual-entry", async (req, res) => {
    try {
        const body = req.body || {};
        const couponNo = clean(body.couponNo);
        const employeeCode = clean(body.employeeCode);
        const sapCode = clean(body.sapCode);
        const employeeName = clean(body.name || body.employeeName);
        const department = clean(body.department);

        if (!couponNo || !employeeCode || !sapCode || !employeeName || !department) {
            return res.status(400).json({
                success: false,
                message: "Name, Coupon No, Employee Code, SAP Code and Department are all required."
            });
        }

        const pool = await getPool();

        const existing = await pool.request()
            .input("CouponNo", sql.NVarChar(50), couponNo)
            .query(`
                SELECT TOP 1 CouponNo
                FROM dbo.EmployeeMaster
                WHERE LTRIM(RTRIM(CAST(CouponNo AS NVARCHAR(50)))) = @CouponNo
            `);

        if (existing.recordset && existing.recordset.length) {
            return res.status(409).json({
                success: false,
                message: "Coupon No already exists. Please enter a unique Coupon No."
            });
        }

        await pool.request()
            .input("CouponNo", sql.NVarChar(50), couponNo)
            .input("EmployeeCode", sql.NVarChar(50), employeeCode)
            .input("SAPCode", sql.NVarChar(50), sapCode)
            .input("EmployeeName", sql.NVarChar(200), employeeName)
            .input("Department", sql.NVarChar(150), department)
            .input("Designation", sql.NVarChar(150), "")
            .input("Unit", sql.NVarChar(100), "")
            .input("Photo", sql.NVarChar(500), "")
            .query(`
                INSERT INTO dbo.EmployeeMaster
                    (CouponNo, EmployeeCode, SAPCode, EmployeeName, Department, Designation, Unit, Photo)
                VALUES
                    (@CouponNo, @EmployeeCode, @SAPCode, @EmployeeName, @Department, @Designation, @Unit, @Photo)
            `);

        return res.status(201).json({
            success: true,
            message: "Employee saved successfully in Employee Master.",
            employee: { couponNo, employeeCode, sapCode, name: employeeName, department }
        });
    } catch (error) {
        console.error("DEPARTMENT EMPLOYEE ENTRY ERROR:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Employee could not be saved."
        });
    }
});

/* =========================================================
   DEPARTMENT TICKET GROUPS - TRACK WHO EACH TICKET IS FOR
   ========================================================= */
async function ensureDepartmentTicketTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.DepartmentTicketGroups', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.DepartmentTicketGroups (
                ID INT IDENTITY(1,1) PRIMARY KEY,
                Department NVARCHAR(150) NOT NULL,
                EmployeeName NVARCHAR(200) NULL,
                TicketCount INT NOT NULL,
                TicketNames NVARCHAR(MAX) NOT NULL,
                CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DepartmentTicketGroups_CreatedAt DEFAULT SYSDATETIME()
            );
        END;
        IF COL_LENGTH('dbo.DepartmentTicketGroups', 'EmployeeName') IS NULL
            ALTER TABLE dbo.DepartmentTicketGroups ADD EmployeeName NVARCHAR(200) NULL;
    `);
}

app.get('/api/department-ticket-groups', async (req, res) => {
    try {
        const pool = await getPool();
        await ensureDepartmentTicketTable(pool);
        const result = await pool.request().query(`
            SELECT ID AS id, COALESCE(EmployeeName, Department) AS employeeName,
                   COALESCE(EmployeeName, Department) AS department, TicketCount AS ticketCount,
                   TicketNames AS ticketNames, CreatedAt AS createdAt
            FROM dbo.DepartmentTicketGroups ORDER BY ID DESC
        `);
        res.json({ success: true, groups: result.recordset || [] });
    } catch (error) {
        console.error('DEPARTMENT TICKET LIST ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Could not load ticket groups.' });
    }
});

app.post('/api/department-ticket-groups', async (req, res) => {
    try {
        const employeeName = clean(req.body && (req.body.employeeName || req.body.department));
        const ticketCount = Number(req.body && req.body.ticketCount);
        const names = Array.isArray(req.body && req.body.ticketNames)
            ? req.body.ticketNames.map(clean).filter(Boolean) : [];
        if (!employeeName) return res.status(400).json({ success: false, message: 'Employee name is required.' });
        if (!Number.isInteger(ticketCount) || ticketCount < 1 || ticketCount > 100)
            return res.status(400).json({ success: false, message: 'Ticket count 1 se 100 ke beech hona chahiye.' });
        if (names.length !== ticketCount)
            return res.status(400).json({ success: false, message: `Aapne ${ticketCount} ticket select kiye hain, isliye exactly ${ticketCount} naam bhariye.` });
        const pool = await getPool();
        await ensureDepartmentTicketTable(pool);
        const result = await pool.request()
            .input('Department', sql.NVarChar(150), employeeName.slice(0, 150))
            .input('EmployeeName', sql.NVarChar(200), employeeName)
            .input('TicketCount', sql.Int, ticketCount)
            .input('TicketNames', sql.NVarChar(sql.MAX), JSON.stringify(names))
            .query(`
                INSERT INTO dbo.DepartmentTicketGroups (Department, EmployeeName, TicketCount, TicketNames)
                OUTPUT INSERTED.ID AS id, COALESCE(INSERTED.EmployeeName, INSERTED.Department) AS employeeName,
                       COALESCE(INSERTED.EmployeeName, INSERTED.Department) AS department,
                       INSERTED.TicketCount AS ticketCount, INSERTED.TicketNames AS ticketNames,
                       INSERTED.CreatedAt AS createdAt
                VALUES (@Department, @EmployeeName, @TicketCount, @TicketNames)
            `);
        res.status(201).json({ success: true, message: 'Employee ticket details saved.', group: result.recordset[0] });
    } catch (error) {
        console.error('DEPARTMENT TICKET SAVE ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Ticket details could not be saved.' });
    }
});

/* =========================================================
   404 API HANDLER
   ========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint not found.",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   SERVER ERROR HANDLER
   ========================================================= */

const server =
    app.listen(
        PORT,
        HOST,
        async () => {

            console.log("");

            console.log(
                "=========================================="
            );

            console.log(
                "   BIRLA CORPORATION DIWALI PRIZE"
            );

            console.log(
                "=========================================="
            );

            console.log("");

            console.log(
                "Database : " +
                dbConfig.database
            );

            console.log(
                "Server   : http://localhost:" +
                PORT
            );

            console.log(
                "LAN      : http://" +
                HOST +
                ":" +
                PORT
            );

            console.log(
                "Photos   : " +
                PHOTO_DIR
            );

            console.log("");

            try {

                await getPool();

                console.log(
                    "SQL SERVER : CONNECTION OK"
                );

            }
            catch (error) {

                console.error(
                    "SQL SERVER : CONNECTION FAILED"
                );

                console.error(
                    error.message
                );

            }

            console.log("");

        }
    );


server.on(
    "error",
    error => {

        if (
            error.code ===
            "EADDRINUSE"
        ) {

            console.error("");
            console.error(
                "=========================================="
            );

            console.error(
                "ERROR: PORT " +
                PORT +
                " IS ALREADY IN USE"
            );

            console.error(
                "Another Node.js server may already be running."
            );

            console.error(
                "=========================================="
            );

            console.error("");

        }
        else {

            console.error(
                "SERVER ERROR:",
                error
            );

        }

    }
);

