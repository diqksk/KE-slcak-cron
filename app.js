const { WebClient, LogLevel } = require("@slack/web-api");
const cron = require("node-cron");

require("dotenv").config();
const ENVIRONMENT = process.env.DEV_ENVIRONMENT;
const client = new WebClient(process.env.BOT_TOKEN, {
  logLevel: LogLevel.DEBUG,
});

/**
 * 메세지를 채널에 전송하는 기능
 *
 * @param {{channel,text}}} msgConfig
 */
const postMsg = async (msgConfig) => {
  try {
    const result = await client.chat.postMessage(msgConfig);

    console.log(result);
  } catch (error) {
    console.error(error);
  }
};

/**
 * QR체크용 메세지를 출력
 */
const writeQRMsg = () => {
  const koreaDate = getKoreanTime();
  const hours = koreaDate.getHours();

  const channelId =
    ENVIRONMENT === "PROD"
      ? process.env.FREE_CHANNEL
      : process.env.TEST_CHANNEL;

  const msgConfig = {
    channel: channelId,
    text: `
  ${hours < 12 ? `${koreaDate.getMonth()}/${koreaDate.getDate()}\n` : ""}
  ${hours} <<--- 👉👉👉이 글에 ${
      hours < 12 ? "오전" : "오후"
    } QR 체크 부탁드립니다!👈👈👈
      `,
  };

  postMsg(msgConfig);
};

/**
 * QR현황을 출력한다
 */
const printQRReminder = async () => {
  const channelId =
    ENVIRONMENT === "PROD"
      ? process.env.FREE_CHANNEL
      : process.env.TEST_CHANNEL;

  const now = getKoreanTime();
  const time = now.getHours();

  const chat = await getLastBotChat(`${time < 12 ? "오전" : "오후"} QR`);

  const timestamp = chat.ts;

  const reactions = await getReactions(timestamp);

  const reactionedUserList = new Set();

  reactions.forEach((reaction) => {
    reaction.users.forEach((user) => {
      reactionedUserList.add(user);
    });
  });

  const { members } = await client.users.list();

  const filtedMembers = members.filter((user) => {
    return (
      user.id !== "USLACKBOT" &&
      !user.is_bot &&
      !reactionedUserList.has(user.id)
    );
  });

  const unCheckedUserStr = filtedMembers.map((member) => `<@${member.id}>`);

  const msgConfig = {
    channel: channelId,
    text: `
${time} <<-- [${time < 12 ? "오전" : "오후"} 출석 결과]\n
 🚀 전체인원: 20\n
 💚 출석인원: ${filtedMembers.length}\n
 💥 미출석: ${!unCheckedUserStr.length ? "전원출석🎉" : unCheckedUserStr}\n\n

 ${
   time < 12
     ? "오늘 하루도 화이팅입니다👊✊"
     : "오늘 하루도 고생 많으셨습니다👍.\n--------------------------"
 }
 `,
  };

  postMsg(msgConfig);
};

/**
 * BOT이 가장 마지막으로 말한 검색어를 가져옴
 * @param {string} query 검색어
 * @returns {Promise<string>}
 */
const getLastBotChat = async (query) => {
  const { messages } = await client.search.messages({
    token: process.env.USER_TOKEN,
    query,
    team_id: process.env.BOT_TEAM_ID,
    sort: "timestamp",
    count: 1,
  });
  return messages.matches[0];
};

/**
 * timestamp에 맞는 메세지에 해당하는 리액션한 정보들을 가져옴
 * @param {string} timestamp
 * @returns {Promise<Object>}
 */
const getReactions = async (timestamp) => {
  const { message } = await client.reactions.get({
    channel: process.env.TEST_CHANNEL,
    timestamp,
    full: true,
  });

  return message.reactions || [];
};

/**
 * 오전 QR
 */
cron.schedule("0 * * * * *", writeQRMsg);
/**
 * 오후 QR
 */

/**
 * 오전 QR 리마인더
 */
cron.schedule("30 * * * * *", printQRReminder);

// cron.schedule("0 * * * * *", writeQRMsg);

// printQRReminder();

const getKoreanTime = () => {
  const localNow = new Date();

  localNow.setHours(localNow.getHours() + 9);
  return localNow;
};
