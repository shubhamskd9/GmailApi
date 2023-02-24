const { google } = require("googleapis");
const { OAuth2 } = google.auth;
const { readFile } = require("fs");
const { promisify } = require("util");
const { createServer } = require("http");
const { URL } = require("url");
const open = require("open");
const fs = require('fs').promises;

const TOKEN_PATH = "./token.json";

async function main() {
  // Load token from file
  const token = JSON.parse(await readFileAsync(TOKEN_PATH));

  // Create OAuth2 client
  const oAuth2Client = new OAuth2(
    "315443154313-gbmg2q6hj2vbn5gk87vn001bf0c447oq.apps.googleusercontent.com",
    "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",
   "http://localhost",
  );

oAuth2Client.setCredentials(token);


  // Create Gmail API client
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  fetchEmails(gmail);
}



async function fetchEmails(gmail) {
  // List messages that don't have any prior replies
  const query = "is:inbox -label:replied";
  const {
    data: { messages },
  } = await gmail.users.messages.list({ userId: "me", q: query });

  console.log(messages.length);
  
  // Reply to each message
  for(let i = 0; i<messages.length-95;i++){

    const id = messages[i].id;
    const {
      data: { payload },
    } = await gmail.users.messages.get({ userId: "me", id });

    // Check if the message has any prior replies
    const thread = payload.headers.find(({ name }) => name === "In-Reply-To");
    if (thread) {
      console.log(`Skipping message ${id} because it has a prior reply.`);
      continue;
    }



    // Extract the sender's email address and the message body
    const from = payload.headers.find(({ name }) => name === "From").value;
    // const body = payload.parts[0].body.data;

    // Compose reply message
    const reply = `Hello ${from},\n\nThank you for your email. This is not an automated response.\n\n`;
  
    console.log(messages[i]);


    sendReply(gmail, id, messages[i].threadId, reply, payload, from);
    
  }
}

async function sendReply(gmail, id, threadId, reply,payload, from) {
  const sentMessage = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      threadId: threadId,
      raw: Buffer.from(
        `To: ${from}\nSubject: Re: ${
          payload.headers.find(({ name }) => name === "Subject").value
        }\n\n${reply}`
      ).toString("base64")
    }
  });
  console.log(`Sent reply to message ${id}: ${sentMessage.data.id}`);


  tagSentEmail(gmail, id, "IMPORTANT");

}

async function tagSentEmail(gmail, messageId, label) {
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [label]
      }
    });
    console.log(`Tagged email with label ${label}: ${messageId}`);
}

async function getLabel(gmail, newLabel) {
  try {
    const res = await gmail.users.labels.list({
      userId: "me",
    });

    const labels = res.data.labels;

    // Check if label already exists
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].name === newLabel) {
        console.log("Label already exists");
        return labels[i];
      }
    }

    // If label doesn't exist, create it
    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: newLabel,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });

    console.log("Label created:", response.data);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

// Authorize and run main function
(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
