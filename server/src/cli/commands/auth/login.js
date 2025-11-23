import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";

dotenv.config();

const URL = "http://localhost:3002";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export async function loginAction(opts) {
  const options = z.object({
    serverUrl: z.string().optional(), // optional(): ZodOptional<z.ZodString>
    clientId: z.string().optional(),
  });

  const serverUrl = options.serverUrl || URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(chalk.bold("🔐 Auth CLI Login"));

  const exisitingToken = false;
  const expired = false;

  if (exisitingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "You are already loggedIn .Do You want to login again ?",
      initialValue: false,
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login Cancelled");
      process.exit(0);
    }
  }

  const authCLient = createAuthClient({ 
    baseURL: serverUrl, plugins: [deviceAuthorizationClient()]
 });
 
 const spinner=yoctoSpinner({text :"Requesting Device Authorization"});
 spinner.start()

 try {
    const {data,error}=await authCLient.device.code({
        client_id:clientId,
        scope:"openid profile email"
    })
    spinner.stop()
    if(error|| !data){
        logger.error(
            `Failed to request the device auth: ${error.error_description}`
        )
        process.exit(0)
    }

   const {
  device_code,
  user_code,
  verification_uri,
  verification_uri_complete,
  interval = 5,
  expires_in,
} = data;

console.log(chalk.cyan("Device Authorization Required"))

console.log(`Please visit ${chalk.underline.blue(verification_uri || verification_uri_complete)}`)

console.log(`Enter Code: ${chalk.bold.green(user_code)}`);

const shouldOpen=await confirm({
    message :"open the browser?",
    initialValue:true
})

if(!isCancel( ) && shouldOpen){
    const urlToOpen=verification_uri || verification_uri_complete
    await open(urlToOpen)
}
console.log(
    chalk.gray(
        `Waiting for authorization (expires in ${Math.floor(
            expires_in/60
        )}minutes)...`
    )
)

 } catch (error) {
    
 }
}

export const login = new Command("login")
  .description("login to better auth ")
  .option("--server-url <url>", "The Better Auth Server URL", URL)
  .option("--client-id <id> ", "The OAUTH client ID", CLIENT_ID)
  .action(loginAction);
