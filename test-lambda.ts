import axios from "axios";
import qs from "qs";

const LAMBDA_ENDPOINT =
  "https://gaxnus4wvh2o6qyznco5t3u5wm0qjmwl.lambda-url.us-west-2.on.aws/process-video-with-targeted-frame";

async function testWorkingCurl() {
  console.log(
    "\n--- Testing with CURL-provided params and x-www-form-urlencoded ---",
  );


  const payload = {
    video_uri:
      "s3://ws-s3-unit-attribute-capture-nova/TRAILER/20260127_123935.mp4",
    container_type: "trailer",
    model: "nova-2-omni",
    region_name: "us-west-2",
    frames_bucket: "",
    frames_prefix: "",
    presigned_expiry_seconds: "",
  };

  try {
    const response = await axios.post(LAMBDA_ENDPOINT, qs.stringify(payload), {
      headers: {
        accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    console.log("Success:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log("Error status:", error.response?.status);
    console.log("Error data:", JSON.stringify(error.response?.data, null, 2));
  }
}

testWorkingCurl();
