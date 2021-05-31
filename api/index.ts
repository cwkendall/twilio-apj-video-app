import '../server/bootstrap-globals';
import { createExpressHandler } from '../server/createExpressHandler';
import express, { RequestHandler } from 'express';
import { ServerlessFunction } from '../server/types';

const PORT = process.env.PORT ?? 8081;

const app = express();
app.use(express.json());

// re-write the token handler because we have support for media-regions in there
const tokenEndpoint = require('./_tokenHandler');

const recordingRulesFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/recordingrules')
  .handler;
const recordingRulesEndpoint = createExpressHandler(recordingRulesFunction);

const noopMiddleware: RequestHandler = (_, __, next) => next();
const authMiddleware =
  process.env.REACT_APP_SET_AUTH === 'firebase' ? require('../server/firebaseAuthMiddleware') : noopMiddleware;

app.all('/api/token', authMiddleware, tokenEndpoint);
app.all('/api/recordingrules', authMiddleware, recordingRulesEndpoint);

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
  next();
});

module.exports = app;