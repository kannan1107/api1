import nodemailer from 'nodemailer';


export default async function sendEmail({ to, subject, text }) {
   try {
       console.log('Sending email to:', to);
       const transporter = nodemailer.createTransport({
           host: 'smtp.gmail.com',
           port: 587,
           secure: false,
           auth: {
               user: process.env.EMAIL_USER,
               pass: process.env.EMAIL_PASS
           },
           tls: {
               rejectUnauthorized: false
           }
       });
       
       const result = await transporter.sendMail({
           from: process.env.EMAIL_USER,
           to,
           subject,
           text
       });
       console.log('Email sent successfully');
       return result;
   } catch (error) {
       console.error('Email error:', error.message);
       throw error;
   }
}
