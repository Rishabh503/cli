#!/usr/bin/env node

import chalk from "chalk"
import dotenv from "dotenv"
import figlet from "figlet"

import { Command } from "commander"
import { wakeUp } from "./commands/ai/wakeUp.js"
import { login, logout, whoami } from "./commands/auth/login.js"

dotenv.config()


async function main(){
    //first banner
    console.log(chalk.cyan(
        figlet.textSync("Rishabh CLI ",{
            font:"standard",
            horizontalLayout:"default"
        })
    ))

    console.log(chalk.yellow("Your Personal CLI  Assitant"))

    const program =new Command("rishabh")
    program.version("0.0.1").description("RISHABH cli - Your Personal CLI Assitant")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami )
    .addCommand(wakeUp)

    program.action(()=>{
        program.help();
    })

    program.parse()
}

main().catch((err)=>{
    console.log(chalk.red("error running the cli tool"),err)
    process.exit(1)
})