const {App, AwsLambdaReceiver} = require('@slack/bolt');
const {GiphyFetch} = require('@giphy/js-fetch-api');
require('isomorphic-fetch')

const gf = new GiphyFetch(process.env.GIPHY_API_KEY)

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
  // The `processBeforeResponse` option is required for all FaaS environments.
  // It allows Bolt methods (e.g. `app.message`) to handle a Slack request
  // before the Bolt framework responds to the request (e.g. `ack()`). This is
  // important because FaaS immediately terminate handlers after the response.
  processBeforeResponse: true
});

app.command('/giffy', async ({command, ack, say, respond}) => {
  // Acknowledge command request
  try {
    await ack();

    const gif = await gf.search(command.text, {limit: 1, rating: 'pg'});
    const gifUrl = gif.data[0].url

    await respond({
      text: `'${command.text}' gif from <@${command.user_id}>. Powered by Giphy.\n${gifUrl}`,
      response_type: 'in_channel'
    })

    // await say({
    //   text: `'${command.text}' gif from <@${command.user_id}>. Powered by Giphy.\n${gifUrl}`,
    //   username: 'Moving Picture Computer Program'
    // });

  } catch (e) {
    await respond('There was an error. Are you in a channel?')
  }
});

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}
