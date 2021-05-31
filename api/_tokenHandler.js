import Twilio from 'twilio';

const AccessToken = Twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
const ChatGrant = AccessToken.ChatGrant;
const MAX_ALLOWED_SESSION_DURATION = 14400;

module.exports = async (request, response) => {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
  const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
  const ROOM_TYPE = process.env.ROOM_TYPE;
  const CONVERSATIONS_SERVICE_SID = process.env.CONVERSATIONS_SERVICE_SID;

  const {
    user_identity,
    room_name,
    create_room = true,
    create_conversation = false,
    media_region = 'gll',
  } = request.body;

  response.setHeader('Content-Type', 'application/json');

  if (typeof create_room !== 'boolean') {
    response.status(400);
    response.send({
      error: {
        message: 'invalid parameter',
        explanation: 'A boolean value must be provided for the create_room parameter',
      },
    });
    return;
  }

  if (typeof create_conversation !== 'boolean') {
    response.status(400);
    response.send({
      error: {
        message: 'invalid parameter',
        explanation: 'A boolean value must be provided for the create_conversation parameter',
      },
    });
    return;
  }

  if (!user_identity) {
    response.status(400);
    response.send({
      error: {
        message: 'missing user_identity',
        explanation: 'The user_identity parameter is missing.',
      },
    });
    return;
  }

  if (!room_name && create_room) {
    response.status(400);
    response.send({
      error: {
        message: 'missing room_name',
        explanation: 'The room_name parameter is missing. room_name is required when create_room is true.',
      },
    });
    return;
  }

  if (create_room) {
    const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    let room;

    try {
      // See if a room already exists
      room = await client.video.rooms(room_name).fetch();
    } catch (e) {
      try {
        // If room doesn't exist, create it
        room = await client.video.rooms.create({ uniqueName: room_name, type: ROOM_TYPE, mediaRegion: media_region });
      } catch (e) {
        response.status(500);
        response.send({
          error: {
            message: 'error creating room',
            explanation: 'Something went wrong when creating a room.',
          },
        });
        return;
      }
    }

    if (create_conversation) {
      const conversationsClient = client.conversations.services(CONVERSATIONS_SERVICE_SID);

      try {
        // See if conversation already exists
        await conversationsClient.conversations(room.sid).fetch();
      } catch (e) {
        try {
          // If conversation doesn't exist, create it.
          // Here we add a timer to close the conversation after the maximum length of a room (24 hours).
          // This helps to clean up old conversations since there is a limit that a single participant
          // can not be added to more than 1,000 open conversations.
          await conversationsClient.conversations.create({ uniqueName: room.sid, 'timers.closed': 'P1D' });
        } catch (e) {
          response.status(500);
          response.send({
            error: {
              message: 'error creating conversation',
              explanation: 'Something went wrong when creating a conversation.',
            },
          });
          return;
        }
      }

      try {
        // Add participant to conversation
        await conversationsClient.conversations(room.sid).participants.create({ identity: user_identity });
      } catch (e) {
        // Ignore "Participant already exists" error (50433)
        if (e.code !== 50433) {
          response.status(500);
          response.send({
            error: {
              message: 'error creating conversation participant',
              explanation: 'Something went wrong when creating a conversation participant.',
            },
          });
          return;
        }
      }
    }
  }

  // Create token
  const token = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
    ttl: MAX_ALLOWED_SESSION_DURATION,
  });

  // Add participant's identity to token
  token.identity = user_identity;

  // Add video grant to token
  const videoGrant = new VideoGrant({ room: room_name });
  token.addGrant(videoGrant);

  // Add chat grant to token
  const chatGrant = new ChatGrant({ serviceSid: CONVERSATIONS_SERVICE_SID });
  token.addGrant(chatGrant);

  // Return token
  response.status(200);
  response.send({ token: token.toJwt(), room_type: ROOM_TYPE });
  return;
};
