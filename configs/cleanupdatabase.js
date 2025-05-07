const mongoose = require('mongoose');
const ChatUserList = require('../models/chatUser'); // Adjust the path to your ChatUserList model

async function cleanupDatabase() {
    try {
        const collection = mongoose.connection.db.collection('chatuserlists');

        // Remove duplicate emails within the same `createdBy`
        const duplicates = await collection.aggregate([
            {
                $group: {
                    _id: { email: "$email", createdBy: "$createdBy" },
                    duplicateIds: { $addToSet: "$_id" },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]).toArray();

        for (const doc of duplicates) {
            const [keepId, ...deleteIds] = doc.duplicateIds;
            await collection.deleteMany({ _id: { $in: deleteIds } });
            console.log(`Removed duplicates for email: ${doc._id.email}, createdBy: ${doc._id.createdBy}`);
        }

        console.log('Database cleanup completed.');
    } catch (error) {
        console.error('Error during database cleanup:', error);
    }
}



module.exports = cleanupDatabase;
