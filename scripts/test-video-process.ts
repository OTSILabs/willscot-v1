import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

async function testMultipartUpload() {
  const url = "http://localhost:3000/api/process-video";
  const filePath = path.join(__dirname, "../sample-video.mp4"); // Ensure a sample video exists or use a dummy file

  if (!fs.existsSync(filePath)) {
    console.error(
      "Please provide a sample-video.mp4 in the root directory for testing.",
    );
    // Create a dummy file for CI/Test purposes if needed
    fs.writeFileSync(filePath, "dummy video content");
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("containerType", "trailer");
  form.append("model", "nova-2-pro");
  form.append("region", "us-west-2");

  console.log("Sending multipart request to:", url);

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error("Error Status:", error.response.status);
      console.error(
        "Error Data:",
        JSON.stringify(error.response.data, null, 2),
      );
    } else {
      console.error("Error Message:", error.message);
    }
  }
}

testMultipartUpload();
