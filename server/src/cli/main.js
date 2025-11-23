#!/usr/bin/env node

import dotenv from "dotenv"
import chalk from "chalk"
import figlet from "figlet"

import {Command} from "commander"
import { login, loginAction } from "./commands/auth/login.js"

dotenv.config()


async function main(){
    //first banner
    console.log(chalk.cyan(
        figlet.textSync("Rishabh CLI ",{
            font:"standard",
            horizontalLayout:"default"
        })
    ))

    console.log(chalk.gray("Your Personal CLI  Assitant"))

    const program =new Command("rishabh")
    program.version("0.0.1").description("RISHABH cli - Your Personal CLI Assitant")
    .addCommand(login)

    program.action(()=>{
        program.help();
    })

    program.parse()
}

main().catch((err)=>{
    console.log(chalk.red("error running the cli tool"),err)
    process.exit(1)
})