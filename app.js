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

function getActionBlocks(inputText, gifUrl, gifIndex) {
  return [
    {
      "type": "image",
      "title": {
        "type": "plain_text",
        "text": inputText,
        "emoji": true
      },
      "image_url": gifUrl,
      "alt_text": inputText
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Send :ok_hand:",
            "emoji": true
          },
          "value": JSON.stringify({inputText, gifUrl, gifIndex}),
          "style": "primary",
          "action_id": "send_button"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Shuffle :recycle:",
            "emoji": true
          },
          "value": JSON.stringify({inputText, gifUrl, gifIndex}),
          "action_id": "shuffle_button"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Cancel :no_good:",
            "emoji": true
          },
          "style": "danger",
          "action_id": "cancel_button"
        }
      ]
    }
  ];
}

app.command('/giffy', async ({command, ack, say, respond}) => {
  // Acknowledge command request
  try {
    await ack();

    const gifUrl = await fetchGifUrl(command.text, 0)

    const blocks = getActionBlocks(command.text, gifUrl, 0)

    await respond({
      blocks,
      response_type: 'ephemeral'
    })

  } catch (e) {
    console.log(e)
    await respond('There was an error, please try again.')
  }
});

async function fetchGifUrl(inputText, index) {
  const gif = await gf.search(inputText, {limit: 30, rating: 'pg'});
  return gif.data[index] ? gif.data[index].images.downsized.url : gif.data[0].images.downsized.url
}

app.action('shuffle_button', async ({action, ack, respond}) => {
  // Acknowledge action request
  await ack();
  const {inputText, gifIndex} = JSON.parse(action.value)
  const newIndex = gifIndex + 1
  const gifUrl = await fetchGifUrl(inputText, newIndex);

  const blocks = getActionBlocks(inputText, gifUrl, newIndex)

  await respond({
    "response_type": "ephemeral",
    blocks,
    "replace_original": true,
    "delete_original": true,
  })
});

app.action('send_button', async ({action, body, ack, say, respond}) => {
  // Acknowledge action request
  await ack();

  const {gifUrl, inputText} = JSON.parse(action.value)

  const blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*\`${inputText}\`* gif from <@${body.user.id}>:`
      }
    },
    {
      "type": "image",
      "image_url": gifUrl,
      "alt_text": inputText
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "Posted using *`/giffy`* | Powered by Giphy."
        }
      ]
    }
  ]

  await respond({
    text: `'${inputText}' gif from <@${body.user.id}>. Powered by Giphy.\n${gifUrl}`,
    blocks,
    response_type: "in_channel",
    "replace_original": true,
    "delete_original": true,
  });
});

app.action('cancel_button', async ({ack, respond}) => {
  await ack()
  await respond({
    text: '',
    "replace_original": true,
    "delete_original": true,
  })
})

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}
