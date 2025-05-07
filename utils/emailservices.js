const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Use your email provider
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
});

/**
 * Send an email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email text content
 */
const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: `"Task Pulse" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};

module.exports = { sendEmail };
