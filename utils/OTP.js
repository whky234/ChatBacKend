const otp=require('otp-generator');

const generatorOtp=()=>{
   return otp.generate(6,{upperCaseAlphabets:false,specialChars:false})
}

module.exports=generatorOtp