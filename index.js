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

	/* 	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${uuidv4()}.${fileType}`,
		Body: req.file.buffer,
		ACL: "public-read",
		ContentType: contentType,
	};
 */
	fs.writeFileSync("example." + fileType, req.file.buffer);

	const extend = ".pdf";
	const enterPath = path.join(__dirname, "/example." + fileType);
	const outputPath = path.join(__dirname, `/example${extend}`);

	// Read file
	const file = fs.readFileSync(enterPath);
	// Convert it to pdf format with undefined filter (see Libreoffice doc about filter)
	libre.convert(file, extend, undefined, (err, done) => {
		if (err) {
			console.log(`Error converting file: ${err}`);
		}

		// Here in done you have pdf file which you can save or transfer in another stream
		fs.writeFileSync(outputPath, done);
	});
	const readFile = fs.readFileSync("example.pdf");

	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${uuidv4()}.pdf`,
		Body: readFile,
		ACL: "public-read",
		ContentType: "application/pdf",
	};

	fs.unlinkSync(enterPath);

	/* 	const readFile = fs.readFileSync("example.pdf");

	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${uuidv4()}.pdf`,
		Body: readFile.buffer,
		ACL: "public-read",
		ContentType: contentType,
	}; */

	s3.upload(params, (error, data) => {
		if (error) {
			res.status(500).send(error);
		}
		res.status(200).send(data);
	});
});

app.listen(port, () => {
	console.log(`Server is up at ${port}`);
});
