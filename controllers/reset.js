const crypto=require('crypto');
const User=require('../models/user');
const bcrypt=require('bcrypt');
const transporter=require('../configs/nodemailer')


const forgotPassword=async(req,res)=>{
    const {email}=req.body;

    const user=await User.findOne({email});

    if(!user){
        return res.status(400).json({message:'user with this email does not exist'})    }

    //generate secure Token
    const resetToken=crypto.randomBytes(20).toString('hex');
    const hashedToken=crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordToken=hashedToken;
    user.resetPasswordExpires=Date.now()+3600000;

    await user.save();

    const resetUrl=`http://localhost:4200/reset-password?token=${resetToken}&email=${email}`

    await transporter.sendMail({
        to:email,
        subject: 'Password Reset Request',
        text: `Please use the following link to reset your password: ${resetUrl}`,
    });

    res.status(200).json({ message: 'Password reset link sent to email' });

}

// Reset Password
const resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // Check if token has expired
    });
  
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }
  
    // Update the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
  
    res.status(200).json({ message: 'Password has been reset successfully' });
  };

module.exports={resetPassword,forgotPassword}