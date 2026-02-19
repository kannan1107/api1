import SibApiV3Sdk from "sib-api-v3-sdk";
import dotenv from "dotenv";

dotenv.config();

const sendMail = async ({ to, subject, text, html, link }) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY not set");
    }

    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = client.authentications["api-key"];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    let htmlContent;
    if (html) {
      htmlContent = html;
    } else if (link) {
      // Corrected with backticks for template literals
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2>Password Reset Request</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          <p>Or copy this link: ${link}</p>
          <p>This link will expire in 1 hour.</p>
        </div>`;
    } else {
      htmlContent = `<div style="font-family: Arial, sans-serif; padding: 20px;"><p>${text.replace(/\n/g, "<br>")}</p></div>`;
    }

    const sendSmtpEmail = {
      to: [{ email: to }],
      sender: {
        email: process.env.EMAIL_SENDER || "kannanmarimuthu1107@gmail.com",
        name: process.env.EMAIL_SENDER_NAME || "Password Manager",
      },
      subject: subject,
      htmlContent: htmlContent,
      textContent: text,
    };

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return result;
  } catch (error) {
    if (error.status === 401) {
      console.error(
        "❌ Brevo Authorization Error: Invalid API Key. Please check BREVO_API_KEY in your .env file.",
      );
    }
    console.error("❌ Brevo Error:", error);
    throw error;
  }
};

export default sendMail;
