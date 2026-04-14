# Spotifi
🎧 Spotifi

A simple music streaming web app with authentication, built using Node.js, Express, and MySQL.

🚀 Giới thiệu

Spotifi là một ứng dụng nghe nhạc fullstack cho phép người dùng:

🎵 Nghe nhạc trực tuyến
🔐 Đăng ký / đăng nhập tài khoản
📁 Upload file audio
❤️ Quản lý nội dung cá nhân

Project được xây dựng nhằm mục tiêu học tập về backend, authentication và xử lý file.

✨ Tính năng
🔐 Authentication (JWT + bcrypt)
🎵 Phát nhạc từ server
⬆️ Upload file audio (multer)
🌐 REST API (Express)
🗄️ Lưu trữ dữ liệu với MySQL
⚡ Serve frontend (HTML/CSS/JS)
🛠️ Công nghệ sử dụng
Backend
Node.js
Express
MySQL (mysql2)
JWT (jsonwebtoken)
Bcrypt (bcrypt)
Multer (upload file)
Dotenv
Frontend
HTML / CSS / JavaScript (vanilla)
📂 Cấu trúc project
Spotifi/
│── node_modules/
│── public/            # Frontend (static files)
│   ├── audio/
│   ├── css/
│   ├── html/
│   └── js/
│
│── src/
│   ├── middleware/    # Middleware (auth, etc.)
│   ├── routes/        # API routes
│   ├── ai.js          # Logic xử lý (tuỳ bạn)
│   ├── db.js          # Kết nối MySQL
│   └── server.js      # Entry point
│
│── .env               # Environment variables
│── package.json
│── README.md
⚙️ Cài đặt
1. Clone repo
git clone https://github.com/nngo7919/Spotifi.git
cd Spotifi
2. Cài dependencies
npm install
3. Cấu hình môi trường

Tạo file .env:

PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=spotifi
JWT_SECRET=your_secret_key
4. Chạy project
Dev mode (auto reload)
npm run dev
Production
npm start
🌐 API (ví dụ)

(Bạn có thể cập nhật thêm nếu muốn chi tiết hơn)

POST /register – đăng ký
POST /login – đăng nhập
GET /songs – lấy danh sách nhạc
POST /upload – upload audio
📁 Upload file

Project sử dụng multer để upload file audio:

File được lưu trong:
public/audio/
🔐 Authentication
Sử dụng JWT
Password được hash bằng bcrypt
🎯 Mục tiêu dự án
Học backend với Node.js
Hiểu cách hoạt động của authentication
Làm việc với database (MySQL)
Xử lý upload file
🚧 Roadmap
 Playlist
 Search nâng cao
 UI giống Spotify hơn
 Streaming tối ưu
 Deploy (Render / VPS)
🤝 Đóng góp

Pull request luôn được chào đón!

📄 License

ISC

👤 Author
GitHub: https://github.com/nngo7919
⭐ Support

Nếu bạn thấy project hữu ích, hãy ⭐ repo nhé!