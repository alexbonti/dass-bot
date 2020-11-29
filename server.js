let express = require("express");
let app = express();
let bodyParser = require('body-parser');
let path = require('path');

//var app = require('express')();
let http = require('http').createServer(app);
let io = require('socket.io')(http);


const dbName='users-t1'
const answersDB = 'answers'


const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://dbUser:dbUser@hyperledgercertificate.hgp6r.mongodb.net/firstdb?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });




var port = process.env.PORT || 8080;


const keyQuestions = [1, 6, 8, 11, 12, 14, 18]

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

app.use(bodyParser.json(), bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname + '/public'));



app.get("/test", function (request, response) {
  var user_name = request.query.user_name;
  response.end("Hello " + user_name + "!");
});


//socket test
io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  setInterval(()=>{
    socket.emit('number', parseInt(Math.random()*10));
  }, 1000);

});








app.get('/test', (req, res) => {
  res.send("All good")
})

recordInteraction = async (userId) => {
  await client.connect();
  let interaction = client.db("chatbot").collection("users").insertOne()


}

handleQuestion = async () => {

  msg = {
    "followupEventInput": {
      "name": "program1"
    }
  }
  return msg

}


const getCurrentQuestion = async (userId) => {
  let userData = await getUserData(userId)
  console.log(userData)
  let found = 0

  for (let a = 0; a < userData.answers.length; a++) {

    for (let i = 0; i < keyQuestions.length; i++) {
      if (!userData.answers[a].answered && userData.answers[a].id == keyQuestions[i]) {
        console.log('[GetCUrrentQuestion]:', keyQuestions[i])
        found = keyQuestions[i]
        break;
      }
      if (found != 0) {
        break;
      }
    }
  }

  return found

}


const getNextQuestion = async (userId) => {
  let msg = {
    "followupEventInput": {
      "name": ''
    }
  }

  try {

    let question = await getCurrentQuestion(userId);
    if (question == 0) {
      return msg = {
        "followupEventInput": {
          "name": "completed"
        }
      }
    }

    msg = {
      "followupEventInput": {
        "name": "program" + question
      }
    }
    console.log('Next Question', msg)

    return msg



  } catch (err) {
    console.log(err);
  }


}

const createNewUser = async (userId) => {
  let msg = {
    "followupEventInput": {
      "name": ''
    }
  }
  /* msg.fulfillmentMessages=[
     {
       "text": {
         "text": [
           "Let's give your answer to these statement. \
           NOTE: Type and answer NEVER or N if you never experienced the feeling"
         ]
       }
     },*/
  try {
    await client.connect();
    const userData = await client.db("chatbot").collection(dbName).find({ userId }).toArray()
    console.log(userId)
    //console.log(userData)
    if (userData.length < 1) {
      console.log('User does not exist, will create now')

      let answers = []
      _populateArray = () => {
        for (i = 0; i < 21; i++) {
          let template = { id: i + 1, answered: false, value: 0, timestamp: null }
          answers.push(template)
        }
        return answers
      }


      const collection = await client.db("chatbot").collection(dbName).insertOne(
        {
          userId: userId,
          dateCreated: Date.now(),
          answers: _populateArray(),
          allAnswered: false
        }
      )
      console.log(collection.ops)
      console.log(answers)
      console.log('user created')
      msg = {
        "followupEventInput": {
          "name": "newUser"
        }
      }
      msg.followupEventInput.name = "newUser"
    } else {

      msg = {
        "followupEventInput": {
          "name": "existingUser"
        }
      }
    }
    return msg
    //return userData;

  } catch (err) {
    console.log(err);
  }

}

const getUserData = async (userId) => {
  try {
    await client.connect();
    const userData = await client.db("chatbot").collection(dbName).findOne({ userId })

    //console.log('[getUserData]:',userData)



    return userData;

  } catch (err) {
    console.log(err);
  }
}

const updateAnswer = async (userId, timestamp, parameters) => {
  // answer , question , followup
  const userData = await getUserData(userId);

  let userAnswer = userData.answers[parameters.question - 1]

  userAnswer.value = parseFloat(parameters.answer)
 
  let questionIndex = parseInt(parameters.question)

  // console.log('[Check Timestamp]', timestamp);

  client.db("chatbot").collection(answersDB).insertOne({ 
    "questionNumber": questionIndex, 
    "userId": userId, 
    "answer" : userAnswer.value,
    "timestamp" : timestamp 
  }, (err, result) => {
    if (err) {
      console.log('Error when inserting answer', err)
    }
  })

  if (!userData.allAnswered) {
    client.db("chatbot").collection(dbName).updateOne({ userId: userId, 'answers.id': questionIndex }, {
      $set: { "answers.$.answered": true, "answers.$.value": userAnswer.value, "answers.$.timestamp": timestamp }
    }, (err, result) => {
      if (err) {
        console.log("Error when update an answer", err)
      }
    })

    if (questionIndex === 21) {
      client.db("chatbot").collection(dbName).updateOne({ userId: userId }, {
        $set: { allAnswered: true, dateCompleted: Date.now() }
      }, (err, result) => {
        if (err) {
          console.log('Error when update database after finish 21 questions', err)
        }
      })
    }
  }
}

/**
 * @description A function to handle actions based on the logicState variable chosen by user.
 * 
 * @param {Object} webhookRequest sent from DialogFlow.
 * 
 * @returns {Object} an object in form of a WebhookResponse.
 */
const handleLogicState = async (webhookRequest) => {
  const logicState = parseInt(webhookRequest.queryResult.parameters.logicState);
  const parameters = webhookRequest.queryResult.parameters;
  let userId = webhookRequest.originalDetectIntentRequest.payload.data.sender.id;
  let timestamp = webhookRequest.originalDetectIntentRequest.payload.data.timestamp;


  console.log('Logic state', logicState)

  let msg = {}

  /* 
  logicState is defined as follow:
  0: Check if user is new or an existing one.
  3: The user asks for result -> server replies in form of a card with option to take user to a webpage containing their results.
  10: Ask user the right questions.
  11: Take user to Home.
  12: Get the next question according to the pre-defined sequence.
  13: 
  */

  switch (logicState) {
    case 0:
      console.log('New Conversation started')
      let resultUser = await createNewUser(webhookRequest.originalDetectIntentRequest.payload.data.sender.id)
      console.log(resultUser)
      let finalResult = {
        payload: resultUser
      }
      return finalResult
      break;

    // Make sure you update the URL in the `fulfillmentMessages` when you have a new tunnel.
    case 3:
      msg.payload = {};
      msg.payload.fulfillmentMessages = [
        {
          "card": {
            "title": "Your Results",
            "subtitle": "Choose action below",
            "buttons": [
              {
                "text": "Show results",
                "postback": `https://325b973324f4.ngrok.io/bot/profile?userId=${userId}`
              },
              {
                "text": "Home",
                "postback": 'home'
              }
            ]
          }
        }
      ]
      break;
    case 10:
      console.log('handling question')
      // let userId = webhookRequest.originalDetectIntentRequest.payload.data.sender.id;

      updateAnswer(userId, timestamp, parameters)
      console.log('[Update Answer Complete]')
      msg = {
        "followupEventInput": {
          "name": parameters.followup != 0 ? "program" + parameters.followup : "end"
        }
      }
      let questionResult = {
        payload: msg
      }
      console.log('[Returning message]', msg)



      return questionResult

      break;

    case 11:
      console.log('Returning user going home')
      // let userId = webhookRequest.originalDetectIntentRequest.payload.data.sender.id;

      msg = {
        "followupEventInput": {
          "name": "home"
        }
      }
      let redirectHome = {
        payload: {
          "followupEventInput": {
            "name": "home"
          }
        }
      }
      console.log('[Returning message]', msg)

      return redirectHome

      break;

    case 12:
      console.log('Getting next Set of questions')
      let nextQuestion = {
        payload: await getNextQuestion(userId)
      }
      console.log('[Returning message]', nextQuestion.payload)
      return nextQuestion



      break;

    case 13:
      console.log('User completed test -> asking random set of questions')

      const userData = await getUserData(userId)
      let mentalState = profileTracker(userData);
      // console.log('[Completed mentalState]', mentalState)
      updateAttempt(mentalState, userId, userData);

      randomQuestionIndex = keyQuestions[Math.floor(Math.random() * keyQuestions.length)];
      
      return randomQuestion = {
        payload : {
          "followupEventInput": {
            "name": "program" + randomQuestionIndex
          }
        }
      }

      break;

    default:
      break;
  }

  return msg;
}

app.post("/bot", async (request, response) => {
  console.log('Hello')
  let { body } = request;
  //console.log('BODY',body)
  console.log('body', body.originalDetectIntentRequest.payload.data)

  let responsePackage = await handleLogicState(body);
  //console.log(responsePackage)

  // msg.payload = userData;
  // msg.result = result;

  // console.log(responsePackage.payload)
  console.log('payload', responsePackage.payload)

  response.send(responsePackage.payload);

});

const updateAttempt = async (mentalState, userId, userData) => {
  client.db("chatbot").collection(dbName).updateOne({ userId: userId }, {
    $addToSet: {
      attempts: {
        completedTime: userData.dateCompleted,
        'mentalState': mentalState,
      }
    }
  }, (err, result) => {
    if (err) {
      console.log('Error when update attempt', err);
    }
  })
}

const profileTracker = (userData) => {
  console.log(userData)

  /// ■ Depression symptoms related items: 3, 5, 10, 13, 16, 17, 21.

  /// ■ Anxiety disorder related items: 2, 4, 7, 9, 15, 19, 20.

  /// ■ Stress related items: 1, 6, 8, 11, 12, 14, 18.
  arrayMaker = (list, originalArray) => {
    let subArray = []
    list.forEach(element => {
      subArray.push(originalArray[element - 1])
    });
    return subArray

  }

  arrayValuesAdder = (originalArray) => {
    let value = 0
    originalArray.forEach(element => {
      value += element.value
    })
    return value
  }

  let stressList = [1, 6, 8, 11, 12, 14, 18]
  let anxietyList = [2, 4, 7, 9, 15, 19, 20]
  let depressionList = [3, 5, 10, 13, 16, 17, 21]

  stressArray = arrayMaker(stressList, userData.answers)
  anxietyArray = arrayMaker(anxietyList, userData.answers)
  depressionArray = arrayMaker(depressionList, userData.answers)

  stressValue = arrayValuesAdder(stressArray)
  anxietyValue = arrayValuesAdder(anxietyArray)
  depressionValue = arrayValuesAdder(depressionArray)



  let mentalState = {
    stressValue, anxietyValue, depressionValue
  }
  return mentalState

}


app.get("/bot/profile", async (request, response) => {
  const userId = request.query.userId;


  const userData = await getUserData(userId)
  let mentalState = profileTracker(userData);

  console.log("[mentalState]: ", mentalState)

  response.render('index', { title: "Under Pressure", userId: userId, mentalState, userData });
});

app.get("/results", async (request, response) => {
  try {
    try {
      await client.connect();
      const testResults = await client.db("chatbot").collection(dbName).find({}).toArray();

      // console.log('[Test Results]:', testResults)

      let timeCompleted = [];
      testResults.forEach(result => {
        timeCompleted.push(new Date(result.dateCompleted));
      })

      response.render('results', { title: "Test Results", users: testResults, timeCompleted });

    } catch (err) {
      console.log(err);
    }
  } catch (err) {

  }
});

//socket test
// io.on('connection', (socket) => {
//   console.log('a user connected');
//   socket.on('disconnect', () => {
//     console.log('user disconnected');
//   });
//   setInterval(()=>{
//     socket.emit('number', parseInt(Math.random()*10));
//   }, 1000);

// });







http.listen(port,()=>{
  console.log("Listening on port ", port);
});

//this is only needed for Cloud foundry 
require("cf-deployment-tracker-client").track();





