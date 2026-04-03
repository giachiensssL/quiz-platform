require('dotenv').config();
const connectDB = require('../config/db');
const Subject = require('../models/Subject');

(async ()=>{
  try{
    await connectDB();
    const matches = await Subject.find({ name: { $regex: '(Kinh tế chính trị|Kinh te chinh tri|Vật lý|Vat ly|Vật lý lý|Vat ly)', $options: 'i' } }).select('name code');
    if(!matches.length){
      console.log('No matching subjects found');
    } else {
      matches.forEach(s=>console.log(`${s.name} (${s.code||'no-code'})`));
    }
    process.exit(0);
  }catch(err){
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
