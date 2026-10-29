const fs = require("fs");

const serverPath = "server.js";
const htmlPath = "public/master.html";
let server = fs.readFileSync(serverPath, "utf8");
let html = fs.readFileSync(htmlPath, "utf8");

function once(text, pattern, replacement, label) {
    const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
    if (matches.length !== 1) {
        throw new Error(label + ": expected exactly 1 match, found " + matches.length);
    }
    return text.replace(pattern, replacement);
}

// GET employee list: include account holder name
const getStart = server.indexOf('app.get(\n    "/api/employees"');
const getEnd = server.indexOf('/* =========================================================\n   EMPLOYEE CRUD ROUTES', getStart);
if (getStart < 0 || getEnd < 0) throw new Error("GET employees route boundary not found");
let getBlock = server.slice(getStart, getEnd);
getBlock = once(
    getBlock,
    /EmployeeName\s+AS\s+name,\s*/,
    "EmployeeName AS name,\n                            AccountHolderName AS accountHolderName,\n                            ",
    "GET account holder"
);
server = server.slice(0, getStart) + getBlock + server.slice(getEnd);

// POST route: account holder input + SQL parameter + INSERT/OUTPUT
const postStart = server.indexOf('app.post("/api/employees"');
const putStart = server.indexOf('app.put("/api/employees/:id"', postStart);
if (postStart < 0 || putStart < 0) throw new Error("POST route boundary not found");
let post = server.slice(postStart, putStart);

post = once(post, /const name = clean\(b\.name \|\| b\.employeeName\);\s*/, m =>
    m + '        const accountHolderName = clean(b.accountHolderName);\n',
    "POST request field");

post = once(post, /(\.input\("EmployeeName",\s*sql\.NVarChar\(200\),\s*name\)\s*)/,
    '$1\n            .input("AccountHolderName", sql.NVarChar(200), accountHolderName)',
    "POST SQL parameter");

post = once(post, /EmployeeName,Department,Designation,Unit,Photo/,
    "EmployeeName,AccountHolderName,Department,Designation,Unit,Photo",
    "POST INSERT columns");

post = once(post, /@EmployeeName,@Department,@Designation,@Unit,@Photo/,
    "@EmployeeName,@AccountHolderName,@Department,@Designation,@Unit,@Photo",
    "POST INSERT values");

post = once(post, /INSERTED\.EmployeeName AS name,\s*/,
    "INSERTED.EmployeeName AS name, INSERTED.AccountHolderName AS accountHolderName,\n                    ",
    "POST response field");

server = server.slice(0, postStart) + post + server.slice(putStart);

// PUT route: account holder input + SQL parameter + UPDATE/SELECT
const newPutStart = server.indexOf('app.put("/api/employees/:id"');
const deleteStart = server.indexOf('app.delete("/api/employees/:id"', newPutStart);
if (newPutStart < 0 || deleteStart < 0) throw new Error("PUT route boundary not found");
let put = server.slice(newPutStart, deleteStart);

put = once(put, /const name = clean\(b\.name \|\| b\.employeeName\);\s*/,
    m => m + '        const accountHolderName = clean(b.accountHolderName);\n',
    "PUT request field");

put = once(put, /(\.input\("EmployeeName",\s*sql\.NVarChar\(200\),\s*name\)\s*)/,
    '$1\n            .input("AccountHolderName", sql.NVarChar(200), accountHolderName)',
    "PUT SQL parameter");

put = once(put, /EmployeeName=@EmployeeName,\s*/,
    "EmployeeName=@EmployeeName, AccountHolderName=@AccountHolderName,\n                    ",
    "PUT UPDATE field");

put = once(put, /EmployeeName AS name,\s*/,
    "EmployeeName AS name, AccountHolderName AS accountHolderName,\n                    ",
    "PUT response field");

server = server.slice(0, newPutStart) + put + server.slice(deleteStart);

// Frontend save payload
html = once(html, /name:\s*el\("fName"\)\.value\.trim\(\),/,
    'name: el("fName").value.trim(),\n\n        accountHolderName: el("fAccountHolder").value.trim(),',
    "Master save payload");

// Frontend edit form
html = once(html, /(el\("fName"\)\.value\s*=\s*employee\.employeeName\s*\|\|\s*employee\.name\s*\|\|\s*"";)/,
    '$1\n\n    el("fAccountHolder").value = employee.accountHolderName || "";',
    "Master edit field");

// Table row: insert Account Holder cell after employee name cell
html = once(html, /(<td>\$\{employee\.employeeName\s*\|\|\s*employee\.name\s*\|\|\s*"-"\}\s*<\/td>)/,
    '$1\n            <td>${employee.accountHolderName || "-"}</td>',
    "Master table cell");

// Validate before writing either file
new Function("require", "module", "__filename", "__dirname", server);
fs.writeFileSync(serverPath, server, "utf8");
fs.writeFileSync(htmlPath, html, "utf8");

console.log("PATCH_OK: employee list/save/update and Master Data form updated.");

