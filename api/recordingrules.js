import firebaseAdmin from 'firebase-admin';
import Twilio from 'twilio';

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_TOKEN)),
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
});

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).send();
  }

  try {
    // Here we authenticate users be verifying the ID token that was sent
    const token = await firebaseAdmin.auth().verifyIdToken(authHeader);

    // Here we authorize users to use this application only if they have a
    // Twilio email address. The logic in this if statement can be changed if
    // you would like to authorize your users in a different manner.
    if (token.email && /@twilio.com$/.test(token.email)) {
      recordingRuleshandler(req, res);
    } else {
      res.status(401).send();
    }
  } catch {
    res.status(401).send();
  }
};

const recordingRuleshandler = async (request, response) => {

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

  response.setHeader('Content-Type', 'application/json');

  const { room_sid, rules } = request.body;

  if (typeof room_sid === 'undefined') {
    response.status(400);
    response.send({
      error: {
        message: 'missing room_sid',
        explanation: 'The room_sid parameter is missing.',
      },
    });
    return;
  }

  if (typeof rules === 'undefined') {
    response.status(400);
    response.send({
      error: {
        message: 'missing rules',
        explanation: 'The rules parameter is missing.',
      },
    });
    return;
  }

  const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  try {
    const recordingRulesResponse = await client.video.rooms(room_sid).recordingRules.update({ rules });
    response.status(200);
    response.send(recordingRulesResponse);
  } catch (err) {
    response.status(500);
    response.send({ error: { message: err.message, code: err.code } });
  }

  return;
};
