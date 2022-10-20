const { WebClient, LogLevel } = require("@slack/web-api");
const cron = require("node-cron");
require("dotenv").config();
const ENVIRONMENT = process.env.DEV_ENVIRONMENT;
const channelId =
  ENVIRONMENT === "PROD"
    ? process.env.ATTENDANCE_CHANNEL
    : process.env.TEST_CHANNEL;

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
  } catch (error) {
    console.error(error);
  }
};

/**
 *
 * QR체크용 메세지를 출력
 */
const writeQRMsg = () => {
  const now = new Date();
  const hours = now.getHours();

  const msgConfig = {
    channel: channelId,
    attachments: [
      {
        text: "QR코드",
        image_url: process.env.QR_IMG,
        thumb_url: process.env.QR_IMG,
      },
    ],
    text: `
  ${hours < 12 ? `${Number(now.getMonth()) + 1}/${now.getDate()}\n` : ""}
👉👉👉이 글에 ${hours < 12 ? "오전" : "오후"} QR 체크 부탁드립니다!👈👈👈
      `,
  };
  try {
    postMsg(msgConfig);
  } catch (e) {
    console.log(e);
  }
};

/**
 * QR현황을 출력한다
 */
const printQRReminder = async () => {
  const now = new Date();
  const time = now.getHours();

  //마지막으로 봇이 오전 or 오후 QR이라고 말한 대화를 검색 (리액션 검색기준)
  const chat = await getLastBotChat(`${time < 12 ? "오전" : "오후"} QR`);

  const timestamp = chat.ts;

  const reactions = await getReactions(timestamp);

  const reactionedUserList = new Set();

  //리액션한 사람들을 필터링해서 set에 넣음
  reactions.forEach((reaction) => {
    reaction.users.forEach((user) => {
      reactionedUserList.add(user);
    });
  });

  //채널에 속한 맴버 리스트 가져오기
  const { members } = await client.conversations.members({
    channel: channelId,
    limit: 30,
  });

  // const { members } = await client.users.list();

  // const filtedMembers = members.filter((user) => {
  //   return (
  //     user.id !== "USLACKBOT" &&
  //     !user.is_bot &&
  //     !reactionedUserList.has(user.id)
  //   );
  // });

  //리액션하지 않은 맴버들 검출
  const filtedMembers = members.filter(
    (member) =>
      member !== process.env.BOT_MEMBER_ID && !reactionedUserList.has(member)
  );

  const unCheckedUserStr = filtedMembers.map((member) => `<@${member}>`);

  const msgConfig = {
    channel: channelId,
    text: `
[${time < 12 ? "오전" : "오후"} 출석 결과]\n
 🚀 전체인원: ${members.length - 1}\n
 💚 출석인원: ${members.length - 1 - filtedMembers.length}\n
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
 * timestamp에 맞는 메세지에 해당하는 리액션한 정보들을 가져온다.
 * @param {string} timestamp
 * @returns {Promise<Object>}
 */
const getReactions = async (timestamp) => {
  const { message } = await client.reactions.get({
    channel: channelId,
    timestamp,
    full: true,
  });

  return message.reactions || [];
};

//오전 QR (07시 30분)
cron.schedule("30 7 * * 1-5", writeQRMsg);
// cron.schedule("*/2 * * * * 1-5", writeQRMsg); <<-- 테스트용
//오후 QR (17시 31분)
cron.schedule("31 17 * * 1-5", writeQRMsg);

//오전 QR 리마인더 (08시 20분)
cron.schedule("20 8 * * 1-5", printQRReminder);
//오후 QR 리마인더 (17시 50분)
cron.schedule("50 17 * * 1-5", printQRReminder);
