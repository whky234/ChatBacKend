const fetch = require("node-fetch");
const base64 = require("base-64");

const Account_ID = "I79HtvEYTKSU80_jPM64_w";
const CLIENT_ID = "VXwVyedrSTyqKqnBhwsa8Q";
const CLIENT_SECRET = "AWWW7qGsbz4tdwX7TOrumWQD9jkMkPfP";

const getAuthHeaders = () => {
    return {
        Authorization: `Basic ${base64.encode(
            `${CLIENT_ID}:${CLIENT_SECRET}`
        )}`,
        "Content-Type": "application/json",
    };
};

const generateZoomAccessToken = async () => {
    try {
        const response = await fetch(
            `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${Account_ID}`,
            {
                method: "POST",
                headers: getAuthHeaders(),
            }
        );

        const jsonResponse = await response.json();
        console.log("Access Token:", jsonResponse);
        return jsonResponse?.access_token;
    } catch (error) {
        console.error("generateZoomAccessToken Error --> ", error);
        throw error;
    }
};


const generateZoomMeeting = async () => {
    try {
        const zoomAccessToken = await generateZoomAccessToken();

        const response = await fetch(
            `https://api.zoom.us/v2/users/me/meetings`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${zoomAccessToken}`,
                },
                body: JSON.stringify({
                    agenda: "Zoom Meeting for Hasni ",
                    duration: 60,
                    password: "12345",
                    settings: {
                        allow_multiple_devices: true,
                        calendar_type: 1,
                        contact_email: "h39483808@gmail.com",
                        contact_name: "Hasni",
                        email_notification: true,
                        encryption_type: "enhanced_encryption",
                        focus_mode: true,
                        host_video: true,
                        join_before_host: true,
                        mute_upon_entry: true,
                        participant_video: true,
                        private_meeting: true,
                        waiting_room: false,
                        watermark: false,
                        continuous_meeting_chat: {
                            enable: true,
                        },
                    },
                    start_time: new Date().toISOString(), // Correcting time format
                    timezone: "Asia/Karachi",
                    topic: "Zoom Meeting for  Hani",
                    type: 2, // Scheduled Meeting
                }),
            }
        );

        const jsonResponse = await response.json();
        console.log("generateZoomMeeting JsonResponse --> ", jsonResponse);
        if (!jsonResponse || !jsonResponse.join_url) {
            throw new Error("Zoom API did not return a valid meeting link");
        }

        return jsonResponse
    } catch (error) {
        console.log("generateZoomMeeting Error --> ", error);
        throw error;
    }
};

module.exports = { generateZoomMeeting };


