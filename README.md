# BIRLA CORPORATION - DIWALI PRIZE

Run:

npm install

node server.js

Open:

http://localhost:3000

DISPLAY PRIZE ORDER:

10.10
10.09
10.08
10.07
10.06
10.05
10.04
10.03
10.02
10.01

9.9
9.8
9.7
9.6
9.5
9.4
9.3
9.2
9.1

8.8 -> 8.1
7.7 -> 7.1
6.6 -> 6.1
5.5 -> 5.1
4.4 -> 4.1
3.3 -> 3.1
2.2 -> 2.1
1.1

TOTAL = 55

Front Page:
- Department field intentionally removed.
- Employee photo area fixed.
- Diwali theme.
- Search.
- Save Prize.
- Clear.
- Master Data.
- Result.
- Display.
- Settings.

Master Data:
- Department.
- Designation.
- Unit.
- Add Employee.
- Employee List.
- Delete.
- Excel Import.
- Excel Export.

Display:
- 55 boxes.
- No scroll.
- Clear button.


## Department Ticket Entry (added)
Open `/department-entry.html`. The new Department Ticket Entry section records department, ticket count, and exactly that many ticket-holder names in SQL Server table `dbo.DepartmentTicketGroups` (created automatically by the API). Existing employee entry behavior is preserved.


## Diwali-Prize-Node-New1 (Festive UI update)
This copy includes a new navy-blue/gold Diwali theme and animated diya GIF at `public/assets/diya-animated.gif`. Existing prize/employee routes and SQL configuration are retained.

Run with `npm install` then `npm start`. Confirm `.env` SQL Server settings before running.
