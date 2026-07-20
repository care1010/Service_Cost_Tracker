📊 Service Cost Tracker - Project Documentation
📝 Project Overview
Yeh ek Data Management Web Application hai. Iska kaam Excel files se data lena, use MySQL database mein store karna, aur ek dashboard (UI) par dikhana hai.

Isme humne Power BI jaise "Measures" (Calculations) aur Multiple Table Joins ka use kiya hai.

📂 Project Folder Structure (Kaunsi file kya karti hai?)
************************
1. Root Folder (/)
Yahan se poora project control hota hai. Isme do main folders hain: client aur server.

************************
2. Backend Folder (/server) - [Node.js & Express]
Backend ka kaam hai Database se baat karna aur data ko Frontend tak pahunchana.
server.js: Yeh backend ki Main Entry Point file hai.
Kaam: Yeh server ko start karti hai (Port 5000 par) aur batati hai ki kaunse "Routes" use karne hain.
.env: Yeh ek secret file hai.
Kaam: Isme Database ka username, password aur host details hoti hain taaki code safe rahe.
config/db.js: Database Connection file.
Kaam: Yeh MySQL se connection banati hai. Isme humne "Pool" use kiya hai taaki application fast chale.
routes/dataRoutes.js: Yeh "Rasta" (Paths) batati hai.
Kaam: Agar koi browser mein /api/data/wbs-summary likhega, toh yeh use sahi Controller ke paas bhej degi.
controllers/dataController.js: Yeh backend ka Dimaag (Logic) hai.
Kaam: Isme SQL Queries likhi jati hain (jaise SELECT * FROM table). Yeh database se data nikal kar JSON format mein wapas bhejta hai.
uploads/: Ek khali folder.
Kaam: Jab hum Excel file upload karenge, toh wo file pehle is folder mein save hogi.

*************************
3. Frontend Folder (/client) - [React.js & Tailwind CSS]
Frontend ka kaam hai user ko ek sundar aur aasan UI dikhana.
src/index.js: React ki entry file.
Kaam: Yeh poori React app ko index.html ke andar load karti hai.
src/App.js: Main Layout file.
Kaam: Isme humne Sidebar (Left side menu) aur Main Content area ko set kiya hai. Yeh decide karta hai ki button click par kaunsa page dikhega.
src/components/: Reusable (Dubara use hone wale) parts.
Sidebar.jsx: Left side ka vertical navigation menu.
DataTable.jsx: Yeh ek common Table hai. Ise humne isliye alag banaya hai taaki humein har page ke liye bar-bar table ka code na likhna pade. Bas data pass karo aur yeh table bana dega.
src/pages/: Main Screens/Views.
SummaryView.jsx: Summary wala page. Yeh Backend API ko call karta hai aur data lekar DataTable ko deta hai.
src/index.css: Tailwind CSS file.
Kaam: Isme humne Tailwind ki zaroori lines likhi hain taaki CSS styles kaam karein.
🛠️ Tech Stack (Humne kya-kya use kiya?)
Technology	Kaam
MySQL	Saara data table format mein store karne ke liye.
Node.js	JavaScript ko server-side chalane ke liye.
Express.js	API banane ke liye (Routes handle karne ke liye).
React.js	Fast aur Dynamic UI banane ke liye.
Tailwind CSS	Design ko aasan aur sundar banane ke liye.
Axios	Frontend se Backend ko request bhejne ke liye.
🔄 Data Flow (Application kaise kaam karti hai?)
Request: User browser par "Summary View" button click karta hai.
Frontend (React): SummaryView.jsx file axios ke zariye http://localhost:5000/api/data/wbs-summary par request bhejti hai.
Backend (Express): server.js request receive karta hai aur dataRoutes ke pass bhejta hai.
Logic (Controller): dataController.js MySQL database mein query chalata hai.
Database (MySQL): Database data nikal kar Controller ko deta hai.
Response: Controller us data ko JSON (ek list) bana kar wapas Frontend ko bhej deta hai.
Render (UI): React us data ko DataTable component mein daal kar screen par dikha deta hai.



*====================*
🚀 How to Run? (Project kaise chalayein?)

###
Step 1: Database Setup
XAMPP start karein aur MySQL chalayein.
phpMyAdmin mein data_project naam ka database banayein aur table create karein.

####
Step 2: Backend Start
Terminal kholiye: cd server
Install karein (agar nahi kiya): npm install
Server chalayein: nodemon server.js

###
Step 3: Frontend Start
Naya terminal kholiye: cd client
Install karein (agar nahi kiya): npm install
React chalayein: npm start





###
💡 Important Rules (Jo humne follow kiye)
DRY (Don't Repeat Yourself): Humne DataTable.jsx aur Sidebar.jsx banaya hai taaki code reuse ho sake.
Separation of Concerns: Design frontend mein hai, aur database ka saara kaam backend mein hai. Dono ek dusre se sirf API ke zariye baat karte hain.


##### IMPORTANT POINT #####
NOTE:=>  ""React mein HTML ko JSX kehte hain aur wo JavaScript ke sath hi rehti hai kyunki React "Components" (chhote-chhote parts) par kaam karta hai.""


##### IMPORTANT POINT #####
##### IMPORTANT POINT #####
##### IMPORTANT POINT #####
##### IMPORTANT POINT #####
non_committed  = column of final_dashboard_table => original column where old values are exist

non_committed_editable = column of final_dashboard_table => input edit column where new saved values are exist


####http://localhost:5000/api/data/run-fix-db