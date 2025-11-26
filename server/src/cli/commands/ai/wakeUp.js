import { select } from "@clack/prompts"
import chalk from "chalk"
import { Command } from "commander"
import yoctoSpinner from "yocto-spinner"
import prisma from "../../../lib/db.js" 
import { getStoredToken } from "../../../lib/token.js" 
import { startChat } from "../../chat-with-ai.js"

const wakeUpAction =async()=>{
    const token=await getStoredToken()
    if(!token?.access_token){
        console.log(chalk.red("not authorized , Please Login again"))
        return;
    }

    const spinner=yoctoSpinner({text:"Fetching User Information"})
    spinner.start()
    const user=await prisma.user.findFirst({
        where:{
            sessions:{
                some:{
                    token:token.access_token
                }
            }
        },select:{
            id:true,
            name:true,
            email:true,
            image:true
        }
    })
    spinner.stop();

    if(!user){
        console.log(chalk.red("No user found"));
        return;

    }
    console.log(chalk.green(`Welcome back , ${user.name}!\n`))
    const choice=await select({
        message:"Select an Option",
        options:[
            {
                value:"chat",
                label:"Chat",
                hint:"Simple Chat with AI"
            },
            {
                value:"tool",
                label:"Tool Calling",
                hint:"Chat with Tools (Google Search , Code Execution)"
            },
            {
                value:"agent",
                label:"Agentic Mode",
                hint:"Advanced AI agent (Coming soon)"
            },
        ]
    });
    switch(choice){
        case "chat":
            // console.log("Chat is Selected")
            startChat("chat")
            break;
        case "tool":
            console.log(chalk.green("Tool Calling is selected"))
            break;
        case "agent":
            console.log(chalk.yellow("Agentic Mode coming soon"))
            break;
    }
}

export const wakeUp=new Command("wakeup")
.description("Wake up the AI")
.action(wakeUpAction)