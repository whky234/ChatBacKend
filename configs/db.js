const mongoose=require('mongoose');
const ChatUserList = require('../models/chatUser'); // Adjust the path to your model

const cleanupDatabase=require('../configs/cleanupdatabase')

const connectDb=async()=>{
    try{
        await mongoose.connect(process.env.Mongo_url,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })


        console.log('mongodb connected');
        cleanupDatabase();
    }catch(err){
  console.error('error connection',err);
  process.exit(1)
    }
}



module.exports=connectDb;