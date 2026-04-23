const http = require("http");

const options = {
  host: "localhost",
  port: process.env.PORT || 3000,
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  path: "/api/health",
=======
  path: '/api/health',
>>>>>>> theirs
=======
  path: '/api/health',
>>>>>>> theirs
=======
  path: "/health",
>>>>>>> theirs
=======
  path: "/health",
>>>>>>> theirs
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.warn(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on("error", (err) => {
<<<<<<< ours
<<<<<<< ours
  console.error("ERROR:", err.message);
=======
  console.log("ERROR:", err.message);
>>>>>>> theirs
=======
  console.log("ERROR:", err.message);
>>>>>>> theirs
  process.exit(1);
});

request.end();
