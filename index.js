require("dotenv/config");

const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
var cors = require("cors");

const libre = require("libreoffice-convert");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 5000;

app.use(cors());

const storage = multer.memoryStorage({
	destination: function (req, file, callback) {
		callback(null, "");
	},
});

const upload = multer({ storage }).single("file");

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ID,
	secretAccessKey: process.env.AWS_SECRET,
});

app.get("/status", (req, res) => {
	res.status(200).send({
		message: "Live",
	});
});

const setContentType = (type) => {
	let contentType = undefined;
	const imageTypes = ["png", "jpg", "jpeg", "gif"];
	if (imageTypes.includes(type)) {
		contentType = "image/png";
	} else if (type === "pdf") {
		contentType = "application/pdf";
	} else {
		contentType = "application/octet-stream";
	}

	return contentType;
};

app.post("/upload", upload, (req, res) => {
	let myFile = req.file.originalname.split(".");
	const fileType = myFile[myFile.length - 1];
	const contentType = setContentType(fileType);

	if (contentType === "image/png") {
		const params = {
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: `${uuidv4()}.${fileType}`,
			Body: req.file.buffer,
			ACL: "public-read",
			ContentType: contentType,
		};

		s3.upload(params, (error, data) => {
			if (error) {
				res.status(500).send(error);
			}
			res.status(200).send(data);
		});
	} else {
		try {
			fs.writeFileSync("example." + fileType, req.file.buffer);
		} catch (e) {
			console.error("cannot write file to disk");
			res.status(500).send({
				timestamp: Date(),
				status: 500,
				error: "Internal Server Error",
				message: "Cannot write file to disk",
			});
		}

		const extend = ".pdf";
		const enterPath = path.join(__dirname, "/example." + fileType);
		const outputPath = path.join(__dirname, `/example${extend}`);

		// Read file

		try {
			const file = fs.readFileSync(enterPath);
			// Convert it to pdf format with undefined filter (see Libreoffice doc about filter)
			libre.convert(file, extend, undefined, (err, done) => {
				if (err) {
					console.log(`Error converting file: ${err}`);
					res.status(500).send({
						timestamp: Date(),
						status: 500,
						error: "Internal Server Error",
						message: "Cannot convert file",
					});
				}
				// Here in done you have pdf file which you can save or transfer in another stream
				fs.writeFileSync(outputPath, done);
			});
		} catch (e) {
			console.error("cannot convert file ");
			res.status(500).send({
				timestamp: Date(),
				status: 500,
				error: "Internal Server Error",
				message: "Cannot convert file",
			});
		}

		const checkTime = 1000;
		function check() {
			setTimeout(() => {
				fs.readFile(outputPath, function (err, data) {
					if (err) {
						// got error reading the file, call check() again
						check();
					} else {
						// we have the file contents here, so do something with it
						// can delete the source file too

						const readFile = fs.readFileSync("example.pdf");

						const params = {
							Bucket: process.env.AWS_BUCKET_NAME,
							Key: `${uuidv4()}.pdf`,
							Body: readFile,
							ACL: "public-read",
							ContentType: "application/pdf",
						};

						s3.upload(params, (error, data) => {
							if (error) {
								res.status(500).send(error);
							}
							res.status(200).send(data);
						});

						fs.unlinkSync(outputPath);
					}
				});
			}, checkTime);
		}

		try {
			check();
		} catch (e) {
			console.error("fail to upload converted file");
			res.status(500).send({
				timestamp: Date(),
				status: 500,
				error: "Internal Server Error",
				message: "Fail to upload converted file",
			});
		}

		try {
			fs.unlinkSync(enterPath);
		} catch (e) {
			console.error("Error removing docs form the disk");
			res.status(500).send({
				timestamp: Date(),
				status: 500,
				error: "Internal Server Error",
				message: "Error removing docs form the disk",
			});
		}
	}
});

app.listen(port, () => {
	console.log(`Server is up at ${port}`);
});
