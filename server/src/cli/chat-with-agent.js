import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro, log, confirm } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AIService } from "./ai/google-sercvice.js";
import { ChatService } from "../service/chat-service.js";
import { getStoredToken } from "../lib/token.js";
import prisma from "../lib/db.js";
import { generateApplication } from "../config/agent.config.js";
// import yoctoSpinner from "yocto-spinner";


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

async function initConversation(userId, conversationId = null, mode = "agent") {
  const spinner = yoctoSpinner({ text: "loading conversation... " }).start();
  const conversation = await chatService.getOrCreate(
    userId,
    conversationId,
    "agent"
  );
  spinner.success("conversation Loaded");
  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n` +
      `${chalk.gray("ID:")} ${conversation.id}\n` +
      `${chalk.gray("Mode:")} ${chalk.magenta("Agent (Code Generator)")}\n` +
      `${chalk.cyan("Working Directory:")} ${process.cwd()}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "magenta",
      title: "🤖 Agent Mode",
      titleAlignment: "center",
    }
  );
  console.log(conversationInfo);

  if (conversation.messages?.length > 0) {
    console.log(chalk.yellow("previous messages : \n"));
    displayMessages(conversation.messages);
  }
  return conversation;
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

function displayMessages(messages) {
  messages.forEach(msg => {
    console.log(chalk[msg.role === 'user' ? 'blue' : 'green'](
      `${msg.role}: ${msg.content}`
    ));
  });
}

async function agentLoop(conversation) {
  const helpBox = boxen(
    `${chalk.cyan.bold("What can the agent do?")}\n` +
      `${chalk.gray("• Generate complete applications from descriptions")}\n` +
      `${chalk.gray("• Create all necessary files and folders")}\n` +
      `${chalk.gray("• Include setup instructions and commands")}\n` +
      `${chalk.gray("• Generate production-ready code")}\n` +
      `${chalk.yellow.bold("Examples:")}\n` +
      `${chalk.white('• "Build a todo app with React and Tailwind"')}\n` +
      `${chalk.white('• "Create a REST API with Express and MongoDB"')}\n` +
      `${chalk.white('• "Make a weather app using OpenWeatherMap API"')}\n` +
      `${chalk.gray('• (Type "exit" to end the session)')}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "agent instructions",
    }
  );
  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.magenta("🤖 What would you like to build?"),
      placeholder: "Describe your application...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Description cannot be empty";
        }

        if (value.trim().length < 10) {
          return "Please provide more details (at least 10 characters)";
        }
      },
    });

    if (isCancel(userInput)) {
      const exitBox = boxen(chalk.yellow("Agent Session ended . GoodbYe"), {
        padding: 1,
        margin: 1,
        borderColor: "yellow",
        borderStyle: "round",
      });
      console.log(exitBox);
      process.exit(0);
    }
    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.yellow("Agent session ended. Goodbye! 👋"), {
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
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "👤 Your Request",
      titleAlignment: "left",
    });

    console.log(userBox);

    await saveMessage(conversation.id, "user", userInput);

    try {
       const spinner = yoctoSpinner({
          text: "AI is thinking...",
          color: "cyan",
        }).start();
        
      const result = await generateApplication(
        userInput,
        aiService,
        process.cwd()
      );
      if (result && result.success) {
        const responseMessage =
          `Generated application: ${result.folderName}\n` +
          `Files created: ${result.files.length}\n` +
          `Location: ${result.appDir}\n\n` +
          `Setup commands:\n${result.commands.join("\n")}`;

        await saveMessage(conversation.id, "assistant", responseMessage);

        spinner.stop()
        // Ask if user wants to generate another app
        const continuePrompt = await confirm({
          message: chalk.cyan(
            "Would you like to generate another application?"
          ),
          initialValue: false,
        });

        if (isCancel(continuePrompt) || !continuePrompt) {
          console.log(chalk.yellow("\n Great Check Your new Application.\n"));
          break;
        } else {
          throw new Error("generation returned nothing ");
        }
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));

      await saveMessage(
        conversation.id,
        "assistant",
        `Error: ${error.message}`
      );

      const retry =  confirm({
        message: chalk.cyan("Would you like to try again?"),
        initialValue: true,
      });

      if (isCancel(retry) || !retry) {
        break;
      }
    }
  }
}

export async function startAgentChat(conversationId = null) {
  try {
    intro(
      boxen(
        chalk.bold.magenta(" 🤖 Orbital AI - Agent Mode\n\n") +
          chalk.gray("Autonomous Application Generator"),
        {
          padding: 1,
          borderStyle: "double",
          borderColor: "magenta",
        }
      )
    );

    const user = await getUserFromToken();

    const shouldContinue = await confirm({
      message: chalk.yellow(
        "⚠️ The agent will create files and folders in the current directory. Continue?"
      ),
      initialValue: true,
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      cancel(chalk.yellow("Agent mode cancelled"));
      process.exit(0);
    }
 const conversation = await initConversation(user.id, conversationId);
    await agentLoop(conversation);

    outro(chalk.green.bold("\n✨ Thanks for using Agent Mode!"));
  } catch (error) {
    const errorBox = boxen(chalk.red(`❌ Error: ${error.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    process.exit(1);
  }
}
