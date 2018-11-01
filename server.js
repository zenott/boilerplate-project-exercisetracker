const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_DB,{ useNewUrlParser: true });

const userSchema = new mongoose.Schema({
  user: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

const logSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const Log = mongoose.model('Log', logSchema);

function isValidDate(dateString) {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  if(!dateString.match(regEx)) return false;  // Invalid format
  var d = new Date(dateString);
  if(Number.isNaN(d.getTime())) return false; // Invalid date
  return d.toISOString().slice(0,10) === dateString;
}

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/exercise/new-user", function (req, res) {
  const newUser=new User({ "user": req.body.username });
  newUser.save(function (err, user) {
    if (err) {
      res.json({"error":err.message})
    } else {
      res.json({ "username": user.user, "_id":user._id })
    }
  });
});

app.post("/api/exercise/add", function (req, res) {
  if(mongoose.Types.ObjectId.isValid(req.body.userId)){
    User.find({_id:req.body.userId},(err, doc)=>{
      if (err) return console.error(err);
      if (doc[0]!==undefined){
        const newLog=new Log();
        newLog.userId=req.body.userId;
        newLog.description=req.body.description;
        newLog.duration=req.body.duration;
        if(req.body.date!='') {
          if(isValidDate(req.body.date)){
            const dateArr=req.body.date.split('-');
            newLog.date=new Date(dateArr[0], dateArr[1]-1, dateArr[2]);
          } else {
            res.json({"error":"invalid date"});
            return;
          } 
        }
        newLog.save(function (err, log) {
              if (err) {
                res.json({"error":err.message});
              } else {
                res.json({ "username": doc[0].user, "description": log.description, "duration": log.duration, "userId": log._id, "date": log.date.toISOString().slice(0,10) })
              }
            });
      } else{
        res.json({"error":"userId not found"});
      }
    });
  } else{
    res.json({"error":"invalid userId"});
  }
});

app.get("/api/exercise/users", function (req, res) {
  User.find(function (err, users) {
    let userArr=[];
    users.forEach(function(user) {
      userArr.push({ "username": user.user, "userId": user._id });
    });
    res.send(userArr);
  });
});

app.get("/api/exercise/log", function (req, res) {
  let resObj={};
  if(req.query.userId){
    resObj.userId=req.query.userId;
    User.findOne({_id:req.query.userId}, function (err, doc) {
      if(doc){
        resObj.userName=doc.user;
        const MAX_TIMESTAMP = 8640000000000000;
        let fromDate=new Date(-MAX_TIMESTAMP);
        let toDate=new Date(MAX_TIMESTAMP);
        let limit=0;
        if(req.query.from) fromDate=new Date(req.query.from.split('-')[0], req.query.from.split('-')[1]-1, req.query.from.split('-')[2]);
        if(req.query.to) toDate=new Date(req.query.to.split('-')[0], req.query.to.split('-')[1]-1, req.query.to.split('-')[2]);
        if(req.query.limit) limit=Number(req.query.limit);
        Log.find({
          userId: req.query.userId, 
          date: { $gte: fromDate, $lte: toDate }
        }).
        limit(limit).
        exec(function (err, logs) {
          let logArr=[];
          let count=0;
          logs.forEach(function(elem) {
            logArr.push({ "description": elem.description, "duration": elem.duration, "date":elem.date.toDateString() });
            count++;
          });
          resObj.count=count;
          resObj.log=logArr;
          res.json(resObj);
        });
      } else {
        res.json({"error":"userId not found"});
      }
    });
  } else{
    res.json({"error":"no userId provided"});
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
