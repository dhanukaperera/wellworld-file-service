require("dotenv/config");

const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");

const { v4: uuidv4 } = require("uuid");
var cors = require("cors");
var multerS3 = require("multer-s3");

const app = express();
const port = 5000;

app.use(cors());

const storage = multer.memoryStorage({
	destination: function (req, file, callback) {
		callback(null, "");
	},
});

/* const upload = multer({ storage }).single("file");
 */

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ID,
	secretAccessKey: process.env.AWS_SECRET,
});

var upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: process.env.AWS_BUCKET_NAME,
		metadata: function (req, file, cb) {
			cb(null, { fieldName: file.fieldname });
		},
		contentType: multerS3.AUTO_CONTENT_TYPE,
		acl: "public-read",
		key: function (req, file, cb) {
			let myFile = file.originalname.split(".");
			const fileType = myFile[myFile.length - 1];
			cb(null, Date.now().toString() + "." + fileType);
		},
	}),
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

app.post("/upload", upload.single("file"), (req, res, next) => {
	console.log("Uploaded!");
	res.send(req.file);
});
/* app.post("/upload", upload, (req, res) => {
	upload.single("file");

	let myFile = req.file.originalname.split(".");
	const fileType = myFile[myFile.length - 1];

	const contentType = setContentType(fileType);
	console.log("fileType", fileType);
	console.log("contentType", contentType);
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
}); */

app.listen(port, () => {
	console.log(`Server is up at ${port}`);
});
