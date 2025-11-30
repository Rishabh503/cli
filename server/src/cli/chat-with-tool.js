import chalk, { Chalk } from "chalk";
import boxen from "boxen";
import {
  text,
  isCancel,
  cancel,
  intro,
  outro,
  multiselect,
} from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AIService } from "./ai/google-sercvice.js";
import { ChatService } from "../service/chat-service.js";
import { getStoredToken } from "../lib/token.js";
import prisma from "../lib/db.js";
import {
  availableTools,
  getEnabledTools,
  enableTools,
  getEnabledToolNames,
  resetTools,
} from "../config/tool.config.js";

marked.use(
  markedTerminal({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    hr: chalk.reset,
    listitem: chalk.reset,
    list: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  })
);

const aiService = new AIService();
const chatService = new ChatService();

async function getUserFromToken() {
  const token = await getStoredToken();
  if (!token?.access_token) {
    throw new Error("not authenicated . please run 'oribtals login' first");
  }
  const spinner = yoctoSpinner({ text: "Authenticating..." }).start();
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
        },
      },
    },
  });

  if (!user) {
    spinner.error("User NotFound");
    throw new Error("User not Found, please login again");
  }
  spinner.success(`Welcome back ,${user.name} `);
  return user;
}

async function selectTool() {
  const toolOptions = availableTools.map((tool) => ({
    value: tool.id,
    label: tool.name,
    hint: tool.description,
  }));

  const selectedTools = await multiselect({
    message: chalk.cyan(
      "select toos to enable (Space to select , Enter to confirm ): "
    ),
    options: toolOptions,
    required: false,
  });
  //can be error here in the iscancel
  if (isCancel(selectedTools)) {
    cancel(chalk.yellow("tools selection cancelled"));
    process.exit(0);
  }

  enableTools(selectedTools);
  if (selectedTools.length === 0) {
    console.log(
      chalk.yellow("\n no tools selected . AI will work without tools")
    );
  } else {
    const toolsBox = boxen(
      chalk.green("✅ Enabled tools:\n") +
        selectedTools
          .map((id) => {
            const tool = availableTools.find((t) => t.id === id);
            return ` • ${tool.name}`;
          })
          .join("\n"),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🛠️ Active Tools",
        titleAlignment: "center",
      }
    );
    console.log(toolsBox);
  }

  return selectedTools.length > 0;
}

async function initConversation(userId, conversationId = null, mode = "tool") {
  const spinner = yoctoSpinner({ text: "loading conversation..." }).start();
  const conversation = await chatService.getOrCreate(
    userId,
    conversationId,
    mode
  );
  spinner.success("conversation loaded");
//   const getEnabledToolNames = getEnabledTools();
const enabledTools = getEnabledTools();
const enabledToolNames = getEnabledToolNames();

  const toolDisplay =
    enableTools.length > 0
      ? `\n${chalk.gray("Active Tools")} ${enabledToolNames.join(", ")}`
      : `\n${chalk.gray("No Active Tools")}`;

  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray(
      "ID: " + conversation.id
    )}\n${chalk.gray("Mode: " + conversation.mode)}${toolDisplay}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "⚪ Tool Calling Session",
      titleAlignment: "center",
    }
  );

  console.log(conversationInfo);

  if (conversation.message?.length > 0) {
    console.log(chalk.yellow(" previous message : \n"));
    displayMessages(conversation.message);
  }
  return conversation;
}

function displayMessages(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "👤 You",
        titleAlignment: "left",
      });
      console.log(userBox);
    } else if (msg.role === "assistant") {
      const renderedContent = marked.parse(msg.content);
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🤖 Assistant (with tools)",
        titleAlignment: "left",
      });
      console.log(assistantBox);
    }
  });
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

async function getAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: "AI Is thinking",
    color: "cyan",
  }).start();

  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);
  const tools = getEnabledTools();

  let fullResponse = "";
  let isFirstChunk = true;
  let toolCallsDetected = [];

  try {
    const result = await aiService.sendMessage(
      aiMessages,
      (chunk) => {
        if (isFirstChunk) {
          spinner.stop();
          console.log("\n");
          console.log(chalk.green.bold(" Assistant"));
          console.log(chalk.gray("-".repeat(60)));
          isFirstChunk = false;
        }
        fullResponse += chunk;
      },
      tools,
      (toolCall) => {
        toolCallsDetected.push(toolCall);
      }
    );

    if (toolCallsDetected.length > 0) {
      console.log("\n");
      const toolCallBox = boxen(
        toolCallsDetected
          .map(
            (tc) =>
              `${chalk.cyan("🛠️ Tool:")} ${tc.toolName}\n${chalk.gray(
                "Args:"
              )} ${JSON.stringify(tc.args)}`
          )
          .join("\n\n"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "cyan",
          title: "⚙️ Tool Calls",
        }
      );
      console.log(toolCallBox);
    }

    console.log("\n");
    const renderedMarkdown = marked.parse(fullResponse);
    console.log(renderedMarkdown);
    console.log(chalk.gray("-".repeat(60)));
    console.log("\n");

    return result.content; // safer than return result.content
  } catch (error) {
    spinner.stop();
    spinner.error("failed to get an ai response");
    throw error;
  }
}


async function updateConversationTitle(
  conversationId,
  userInput,
  messageCount
) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");

    await chatService.updateTitle(conversationId, title);
  }
}

async function chatLoop(conversation) {
  const enabledToolNames = getEnabledToolNames();
  const helpBox = boxen(
    `${chalk.gray("• Type your message and press Enter")}\n${chalk.gray(
      "• AI has access to:"
    )} ${
      enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No tools"
    }\n${chalk.gray('• Type "exit" to end conversation')}\n${chalk.gray(
      "• Press Ctrl+C to quit anytime"
    )}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    }
  );

  console.log(helpBox);
  //
  while (true) {
    const userInput = await text({
      message: chalk.blue("Your message"),
      placeholder: "Type your Message",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "message cant be empty";
        }
      },
    });

    if (isCancel(userInput)) {
      const exitBox = boxen(chalk.yellow("Chat Session ended . GoodbYe"), {
        padding: 1,
        margin: 1,
        borderColor: "yellow",
        borderStyle: "round",
      });
      console.log(exitBox);
      process.exit(0);
    }

    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      });
      console.log(exitBox);
      break;
    }

    const userBox = boxen(chalk.white(userInput), {
      padding: 1,
      margin: { left: 2, top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "👤 You ",
      titleAlignment: "left",
    });
    console.log(userBox);

    await saveMessage(conversation.id, "user", userInput);
    const messages = await chatService.getMessages(conversation.id);
    const aiResponse = await getAIResponse(conversation.id);

    await saveMessage(conversation.id, "assistant", aiResponse);

    await updateConversationTitle(conversation.id, userInput, messages.length);
  }
}

export async function startToolChat(conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan(" Orbital AI - Tool Calling Mode"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      })
    );

    const user = await getUserFromToken();
    await selectTool();
    const conversation = await initConversation(
      user.id,
      conversationId,
      "tool"
    );
    await chatLoop(conversation);
    resetTools();
    outro(chalk.green("Thanks for using the tools method"));
  } catch (error) {
    const errorbox = boxen(chalk.red(`Error : ${error.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorbox);
    resetTools();
    process.exit(1);
  }
}
