require("dotenv/config");

const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
var cors = require("cors");

const app = express();
const port = 5000;
var request = require("request");

const PDFDocument = require("pdfkit");
const fs = require("fs");
const merge = require("easy-pdf-merge");

app.use(cors());

const mergePdf = () => {
	request.get(
		"https://wellworld-attachments.s3.amazonaws.com/15ac609b-2b6e-4a4d-849f-b7d9978f6bff.pdf",
		function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var csv = body;
				merge([csv, csv], "new2.pdf", function (err) {
					if (err) {
						return console.log(err);
					}
					console.log("Success");
				});
			}
		}
	);

	/* merge(["output.pdf", "output.pdf"], "new.pdf", function (err) {
		if (err) {
			return console.log(err);
		}
		console.log("Success");
	}); */
};

const createPdf = () => {
	const doc = new PDFDocument();
	doc.pipe(fs.createWriteStream("output.pdf"));
	doc.fontSize(25).text("Some text with an embedded font!", 0, 0);
	doc.end();
};

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
	//createPdf();
	//uploadFile("output.pdf");
	mergePdf();
	res.status(200).send({
		message: "Live",
	});
});

app.post("/upload", upload, (req, res) => {
	let myFile = req.file.originalname.split(".");
	const fileType = myFile[myFile.length - 1];

	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${uuidv4()}.${fileType}`,
		Body: req.file.buffer,
		ACL: "public-read",
	};

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

const fileName = "output.pdf";

const uploadFile = (fileName) => {
	// Read content from the file
	const fileContent = fs.readFileSync(fileName);

	// Setting up S3 upload parameters
	const params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: `${uuidv4()}.pdf`,
		Body: fileContent,
		ACL: "public-read",
	};

	// Uploading files to the bucket
	s3.upload(params, function (err, data) {
		if (err) {
			throw err;
		}
		console.log(`File uploaded successfully. ${data.Location}`);
	});
};
